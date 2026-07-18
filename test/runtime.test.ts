import { describe, expect, it } from "vitest";
import {
  DemoRuntime,
  MemoryDemoStateStore,
} from "../src/demo/runtime";
import { BASE_DEMO_SOURCE, DEMO_SOURCE } from "../src/demo/source";

const successfulOperations = (
  runtime: DemoRuntime,
  direction: "forward" | "backward",
) =>
  runtime
    .getSnapshot()
    .events.filter(
      (event) => event.direction === direction && event.status === "succeeded",
    );

describe("DemoRuntime preview environment", () => {
  it("turns the AI's one-line cache change into a derived inverse-plan change", () => {
    const runtime = new DemoRuntime({ delayMs: 0 });
    const before = runtime.inspectSource(BASE_DEMO_SOURCE);
    const after = runtime.inspectSource(DEMO_SOURCE);

    expect(before).toMatchObject({ status: "valid" });
    expect(after).toMatchObject({ status: "valid" });
    if (before.status !== "valid" || after.status !== "valid") return;

    expect(after.forward.map((step) => step.operation)).toEqual([
      "create_namespace",
      "create_database",
      "create_cache",
      "seed_preview_data",
      "deploy_application",
      "attach_preview_url",
    ]);
    expect(after.backward.map((step) => step.operation)).toEqual([
      "detach_preview_url",
      "undeploy_application",
      "unseed_preview_data",
      "delete_cache",
      "delete_database",
      "delete_namespace",
    ]);
    expect(before.backward.map((step) => step.operation)).not.toContain(
      "delete_cache",
    );
    expect(after.planHash).not.toBe(before.planHash);
  });

  it("keeps the preview live after Runtime A ends and resumes from Runtime B", async () => {
    const store = new MemoryDemoStateStore();
    const runtimeA = new DemoRuntime({ delayMs: 0, store });

    const opened = await runtimeA.openPreview();

    expect(opened.status).toBe("succeeded");
    expect(runtimeA.getSnapshot().resources.map((resource) => resource.label)).toEqual([
      "Namespace",
      "Database",
      "Cache",
      "Preview data",
      "Application",
      "Preview URL",
    ]);
    const record = runtimeA.getSnapshot().execution;
    expect(record).toMatchObject({
      version: 1,
      executionId: "exec_418_01",
      procedureName: "preview_environment",
      status: "live",
      receipts: expect.any(Array),
    });
    expect(record?.receipts).toHaveLength(6);
    expect(() => JSON.stringify(record)).not.toThrow();

    const runtimeB = new DemoRuntime({ delayMs: 0, store });
    expect(runtimeB.getSnapshot()).toMatchObject({
      stage: "live",
      canResume: true,
    });
    expect(runtimeB.getSnapshot().resources).toHaveLength(6);

    runtimeB.resume("exec_418_01");
    expect(runtimeB.getSnapshot()).toMatchObject({
      stage: "review",
      canUncall: true,
    });
    await expect(runtimeB.uncall()).resolves.toEqual({ status: "succeeded" });

    expect(runtimeB.getSnapshot().resources).toEqual([]);
    expect(runtimeB.getSnapshot().execution).toMatchObject({
      status: "completed",
      receipts: [],
    });
    expect(
      successfulOperations(runtimeB, "backward").map((event) => event.operation),
    ).toEqual([
      "detach_preview_url",
      "undeploy_application",
      "unseed_preview_data",
      "delete_cache",
      "delete_database",
      "delete_namespace",
    ]);
    expect(
      runtimeB
        .getSnapshot()
        .events.filter((event) => event.direction === "backward")
        .every((event) => event.process === "runtime-b"),
    ).toBe(true);
  });

  it.each([
    "create_namespace",
    "create_database",
    "create_cache",
    "seed_preview_data",
    "deploy_application",
    "attach_preview_url",
  ])(
    "automatically compensates exactly the completed prefix when %s fails",
    async (failAt) => {
      const runtime = new DemoRuntime({ delayMs: 0 });

      const result = await runtime.run({ failAt });

      expect(result.status).toBe("rolled-back");
      expect(runtime.getSnapshot().resources).toEqual([]);
      const forwardReceiptIds = successfulOperations(runtime, "forward").map(
        (event) => event.resourceId,
      );
      const backwardReceiptIds = successfulOperations(runtime, "backward").map(
        (event) => event.resourceId,
      );
      expect(backwardReceiptIds).toEqual([...forwardReceiptIds].reverse());
      expect(
        runtime
          .getSnapshot()
          .events.some(
            (event) =>
              event.operation === failAt &&
              event.direction === "forward" &&
              event.status === "failed",
          ),
      ).toBe(true);
    },
  );

  it("stops checked reversal at drift and persists the unconsumed receipts", async () => {
    const store = new MemoryDemoStateStore();
    const runtimeA = new DemoRuntime({ delayMs: 0, store });
    await runtimeA.openPreview();
    const changed = runtimeA.simulateDatabaseDrift();
    expect(changed.generation).toBe(3);

    const runtimeB = new DemoRuntime({ delayMs: 0, store });
    runtimeB.resume();
    const result = await runtimeB.uncall();

    expect(result).toMatchObject({
      status: "blocked",
      reason: {
        operation: "delete_database",
        expectedGeneration: 2,
        currentGeneration: 3,
      },
    });
    expect(runtimeB.getSnapshot().resources.map((resource) => resource.label)).toEqual([
      "Namespace",
      "Database",
    ]);
    expect(
      runtimeB.getSnapshot().execution?.receipts.map((entry) => entry.primitiveName),
    ).toEqual(["create_namespace", "create_database"]);
    expect(runtimeB.getSnapshot()).toMatchObject({
      stage: "blocked",
      execution: {
        status: "blocked",
        blockedReason: {
          resourceId: "database-pr418-02",
          message: expect.stringContaining("manual decision required"),
        },
      },
    });

    const afterReload = new DemoRuntime({ delayMs: 0, store });
    expect(afterReload.getSnapshot().execution?.receipts).toHaveLength(2);
    expect(afterReload.getSnapshot().resources).toHaveLength(2);
  });

  it("compiles editable source on every run and reports source locations", async () => {
    const runtime = new DemoRuntime({ delayMs: 0 });

    await expect(
      runtime.run({ source: "procedure deploy()\ncall missing()" }),
    ).resolves.toMatchObject({
      status: "compile-failed",
      error: expect.stringContaining("at 2:6"),
    });
    await expect(runtime.run()).resolves.toEqual({ status: "succeeded" });
    await expect(runtime.uncall()).resolves.toEqual({ status: "succeeded" });
    expect(runtime.getSnapshot().resources).toEqual([]);
  });
});
