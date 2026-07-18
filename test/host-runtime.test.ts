import { describe, expect, it } from "vitest";
import {
  compileHostModule,
  HostCompileError,
  HostExecutor,
  PrimitiveRegistry,
  ReceiptJournal,
  type HostPrimitive,
} from "../src/host";

type TestReceipt = {
  primitiveName: string;
  id: number;
};

type Harness = {
  registry: PrimitiveRegistry;
  log: string[];
  failForward: Set<string>;
  failBackward: Set<string>;
};

const createHarness = (names: readonly string[]): Harness => {
  const registry = new PrimitiveRegistry();
  const log: string[] = [];
  const failForward = new Set<string>();
  const failBackward = new Set<string>();
  let nextId = 1;

  for (const primitiveName of names) {
    const primitive: HostPrimitive<TestReceipt> = {
      forward: async (context) => {
        log.push(`forward:${context.primitiveName}`);
        if (failForward.has(primitiveName)) {
          throw new Error(`${primitiveName} forward exploded`);
        }
        return { primitiveName, id: nextId++ };
      },
      backward: async (receipt, context) => {
        log.push(`backward:${context.primitiveName}`);
        expect(receipt.primitiveName).toBe(primitiveName);
        if (failBackward.has(primitiveName)) {
          throw new Error(`${primitiveName} backward exploded`);
        }
      },
    };
    registry.register(primitiveName, primitive);
  }

  return { registry, log, failForward, failBackward };
};

describe("Host compiler and primitive registry", () => {
  it("derives linker manifests from registered handlers", () => {
    const { registry } = createHarness(["Create_Thing"]);

    expect(registry.manifests).toEqual([
      { name: "create_thing", hasForward: true, hasBackward: true },
    ]);
    expect(() =>
      compileHostModule("procedure deploy()\ncall CREATE_THING()", registry),
    ).not.toThrow();
  });

  it("rejects data and structured control in host modules with source spans", () => {
    const { registry } = createHarness(["effect"]);

    expect(() =>
      compileHostModule(
        `value
procedure deploy()
  if 1 then call effect() fi 1`,
        registry,
      ),
    ).toThrowError(HostCompileError);

    try {
      compileHostModule(
        `value
procedure deploy()
  if 1 then call effect() fi 1`,
        registry,
      );
    } catch (error) {
      expect(error).toMatchObject({
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining("data declaration"),
            span: expect.objectContaining({
              start: expect.objectContaining({ line: 1, column: 1 }),
            }),
          }),
          expect.objectContaining({
            message: expect.stringContaining("if is not allowed"),
            span: expect.objectContaining({
              start: expect.objectContaining({ line: 3, column: 3 }),
            }),
          }),
        ]),
      });
    }
  });

  it("rejects direct and mutual host procedure recursion", () => {
    const emptyRegistry = new PrimitiveRegistry();

    expect(() =>
      compileHostModule("procedure recurse()\ncall recurse()", emptyRegistry),
    ).toThrowError(/Recursive host procedure call/);
    expect(() =>
      compileHostModule(
        `procedure first()
  call second()
procedure second()
  call first()`,
        emptyRegistry,
      ),
    ).toThrowError(/Recursive host procedure call/);
  });
});

describe("HostExecutor", () => {
  it("executes primitive forward handlers in AST order and top-level uncall in reverse", async () => {
    const harness = createHarness(["one", "two", "three"]);
    const module = compileHostModule(
      `procedure deploy()
  call one()
  call two()
  call three()`,
      harness.registry,
    );
    const executor = new HostExecutor(module, harness.registry);

    await expect(executor.call("deploy")).resolves.toMatchObject({
      status: "succeeded",
      journalSize: 3,
    });
    await expect(executor.uncall("deploy")).resolves.toMatchObject({
      status: "succeeded",
      journalSize: 0,
    });

    expect(harness.log).toEqual([
      "forward:one",
      "forward:two",
      "forward:three",
      "backward:three",
      "backward:two",
      "backward:one",
    ]);
  });

  it("composes nested procedure call and uncall directions", async () => {
    const harness = createHarness(["one", "two"]);
    const module = compileHostModule(
      `procedure deploy()
  call effect()
  uncall effect()
  call effect()
procedure effect()
  call one()
  call two()`,
      harness.registry,
    );
    const executor = new HostExecutor(module, harness.registry);

    expect((await executor.call("deploy")).status).toBe("succeeded");
    expect(harness.log).toEqual([
      "forward:one",
      "forward:two",
      "backward:two",
      "backward:one",
      "forward:one",
      "forward:two",
    ]);

    expect((await executor.uncall("deploy")).status).toBe("succeeded");
    expect(harness.log.slice(6)).toEqual([
      "backward:two",
      "backward:one",
      "forward:one",
      "forward:two",
      "backward:two",
      "backward:one",
    ]);
    expect(executor.journal.length).toBe(0);
  });

  it("compensates only successful actions from a failed forward run", async () => {
    const harness = createHarness(["one", "two", "three"]);
    harness.failForward.add("two");
    const module = compileHostModule(
      `procedure deploy()
  call one()
  call two()
  call three()`,
      harness.registry,
    );
    const executor = new HostExecutor(module, harness.registry);

    const result = await executor.call("deploy");

    expect(result).toMatchObject({
      status: "failed",
      error: { code: "primitive-failed" },
      cleanupErrors: [],
      journalSize: 0,
    });
    expect(harness.log).toEqual([
      "forward:one",
      "forward:two",
      "backward:one",
    ]);
  });

  it("reports missing and mismatched receipts without consuming the journal", async () => {
    const harness = createHarness(["one", "two"]);
    const module = compileHostModule(
      `procedure make()
  call one()
procedure wrong()
  uncall two()`,
      harness.registry,
    );
    const emptyExecutor = new HostExecutor(module, harness.registry);

    await expect(emptyExecutor.call("wrong")).resolves.toMatchObject({
      status: "failed",
      error: { code: "receipt-missing", span: { start: { line: 4, column: 3 } } },
      journalSize: 0,
    });

    const executor = new HostExecutor(module, harness.registry);
    expect((await executor.call("make")).status).toBe("succeeded");
    await expect(executor.call("wrong")).resolves.toMatchObject({
      status: "failed",
      error: { code: "receipt-mismatch" },
      journalSize: 1,
    });
    expect(executor.journal.entries[0]?.primitiveName).toBe("one");
  });

  it("keeps a receipt when cleanup fails and separates both failures", async () => {
    const harness = createHarness(["one", "two"]);
    harness.failForward.add("two");
    harness.failBackward.add("one");
    const module = compileHostModule(
      `procedure deploy()
  call one()
  call two()`,
      harness.registry,
    );
    const executor = new HostExecutor(module, harness.registry);

    const result = await executor.call("deploy");

    expect(result).toMatchObject({
      status: "failed",
      error: {
        code: "primitive-failed",
        message: expect.stringContaining("two forward exploded"),
      },
      cleanupErrors: [
        {
          code: "cleanup-failed",
          message: expect.stringContaining("one backward exploded"),
        },
      ],
      journalSize: 1,
    });
    expect(executor.journal.entries[0]?.primitiveName).toBe("one");
  });

  it("rejects receipts belonging to another executor session", async () => {
    const harness = createHarness(["one"]);
    const module = compileHostModule(
      "procedure deploy()\ncall one()",
      harness.registry,
    );
    const sharedJournal = new ReceiptJournal();
    const first = new HostExecutor(module, harness.registry, {
      sessionId: "first",
      journal: sharedJournal,
    });
    const second = new HostExecutor(module, harness.registry, {
      sessionId: "second",
      journal: sharedJournal,
    });

    expect((await first.call("deploy")).status).toBe("succeeded");
    await expect(second.uncall("deploy")).resolves.toMatchObject({
      status: "failed",
      error: { code: "foreign-receipt" },
      journalSize: 1,
    });
    expect(sharedJournal.length).toBe(1);
  });

  it("rejects concurrent execution in the same session", async () => {
    let releaseForward: (() => void) | undefined;
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      releaseForward = resolve;
    });
    const registry = new PrimitiveRegistry().register("slow", {
      forward: async () => {
        markStarted?.();
        await gate;
        return { ok: true };
      },
      backward: async () => undefined,
    });
    const module = compileHostModule("procedure deploy()\ncall slow()", registry);
    const executor = new HostExecutor(module, registry);

    const firstRun = executor.call("deploy");
    await started;
    await expect(executor.call("deploy")).resolves.toMatchObject({
      status: "failed",
      error: { code: "concurrent-execution" },
    });
    releaseForward?.();
    await expect(firstRun).resolves.toMatchObject({ status: "succeeded" });
  });
});
