import type { Direction } from "../janus/ast";
import type {
  ResolvedModule,
  ResolvedProcedure,
  ResolvedStatement,
} from "../janus/resolver";
import type { SourceSpan } from "../janus/span";
import { errorMessage, HostRuntimeError } from "./errors";
import {
  PrimitiveRegistry,
  type HostPrimitiveContext,
  type RegisteredHostPrimitive,
} from "./primitive";

export type ReceiptJournalEntry = {
  readonly sessionId: string;
  readonly runId: number;
  readonly primitiveName: string;
  readonly receipt: unknown;
  readonly span: SourceSpan;
};

export class ReceiptJournal {
  readonly #entries: ReceiptJournalEntry[] = [];

  get length(): number {
    return this.#entries.length;
  }

  get entries(): readonly ReceiptJournalEntry[] {
    return this.#entries.map((entry) => ({ ...entry }));
  }

  peek(): ReceiptJournalEntry | undefined {
    return this.#entries.at(-1);
  }

  push(entry: ReceiptJournalEntry): void {
    this.#entries.push(entry);
  }

  remove(entry: ReceiptJournalEntry): void {
    if (this.peek() !== entry) {
      throw new Error("Receipt journal changed during primitive execution");
    }
    this.#entries.pop();
  }
}

export type HostExecutionEvent = {
  readonly sessionId: string;
  readonly primitiveName: string;
  readonly direction: Direction;
  readonly status: "started" | "succeeded" | "failed";
  readonly span: SourceSpan;
  readonly receipt?: unknown;
  readonly error?: HostRuntimeError;
};

export type HostExecutionResult =
  | {
      readonly status: "succeeded";
      readonly journalSize: number;
    }
  | {
      readonly status: "failed";
      readonly error: HostRuntimeError;
      readonly cleanupErrors: readonly HostRuntimeError[];
      readonly journalSize: number;
    };

export type HostExecutorOptions = {
  sessionId?: string;
  journal?: ReceiptJournal;
  onEvent?: (event: HostExecutionEvent) => void;
};

let nextSessionId = 1;

const reverseDirection = (direction: Direction): Direction =>
  direction === "forward" ? "backward" : "forward";

export class HostExecutor {
  readonly sessionId: string;
  readonly journal: ReceiptJournal;
  readonly #procedures: ReadonlyMap<string, ResolvedProcedure>;
  readonly #onEvent: ((event: HostExecutionEvent) => void) | undefined;
  #isExecuting = false;
  #nextRunId = 1;

  constructor(
    readonly module: ResolvedModule,
    readonly primitives: PrimitiveRegistry,
    options: HostExecutorOptions = {},
  ) {
    this.sessionId = options.sessionId ?? `host-session-${nextSessionId++}`;
    this.journal = options.journal ?? new ReceiptJournal();
    this.#onEvent = options.onEvent;
    this.#procedures = new Map(
      module.procedures.map((procedure) => [procedure.name, procedure]),
    );
  }

  get isExecuting(): boolean {
    return this.#isExecuting;
  }

  call(procedureName: string): Promise<HostExecutionResult> {
    return this.execute(procedureName, "forward");
  }

  uncall(procedureName: string): Promise<HostExecutionResult> {
    return this.execute(procedureName, "backward");
  }

  async execute(
    procedureName: string,
    direction: Direction,
  ): Promise<HostExecutionResult> {
    if (this.#isExecuting) {
      const error = new HostRuntimeError(
        "The host executor is already executing",
        this.module.span,
        "concurrent-execution",
      );
      return {
        status: "failed",
        error,
        cleanupErrors: [],
        journalSize: this.journal.length,
      };
    }

    this.#isExecuting = true;
    const runId = this.#nextRunId++;
    try {
      await this.#executeProcedure(
        procedureName.toLowerCase(),
        direction,
        this.module.span,
        new Set(),
        runId,
      );
      return { status: "succeeded", journalSize: this.journal.length };
    } catch (error) {
      const runtimeError =
        error instanceof HostRuntimeError
          ? error
          : new HostRuntimeError(
              errorMessage(error),
              this.module.span,
              "primitive-failed",
              { cause: error },
            );
      const cleanupErrors =
        direction === "forward" ? await this.#compensate(runId) : [];
      return {
        status: "failed",
        error: runtimeError,
        cleanupErrors,
        journalSize: this.journal.length,
      };
    } finally {
      this.#isExecuting = false;
    }
  }

  async #executeProcedure(
    name: string,
    direction: Direction,
    span: SourceSpan,
    activeProcedures: Set<string>,
    runId: number,
  ): Promise<void> {
    const procedure = this.#procedures.get(name);
    if (procedure === undefined) {
      throw new HostRuntimeError(
        `Unknown host procedure ${JSON.stringify(name)}`,
        span,
        "unknown-procedure",
      );
    }
    if (activeProcedures.has(name)) {
      throw new HostRuntimeError(
        `Recursive host procedure call to ${JSON.stringify(name)} is not allowed`,
        span,
        "recursive-call",
      );
    }

    activeProcedures.add(name);
    try {
      await this.#executeSequence(procedure.body, direction, activeProcedures, runId);
    } finally {
      activeProcedures.delete(name);
    }
  }

  async #executeSequence(
    statements: readonly ResolvedStatement[],
    direction: Direction,
    activeProcedures: Set<string>,
    runId: number,
  ): Promise<void> {
    if (direction === "forward") {
      for (const statement of statements) {
        await this.#executeStatement(statement, direction, activeProcedures, runId);
      }
      return;
    }

    for (let index = statements.length - 1; index >= 0; index -= 1) {
      const statement = statements[index];
      if (statement !== undefined) {
        await this.#executeStatement(statement, direction, activeProcedures, runId);
      }
    }
  }

  async #executeStatement(
    statement: ResolvedStatement,
    executionDirection: Direction,
    activeProcedures: Set<string>,
    runId: number,
  ): Promise<void> {
    if (statement.kind !== "CallStatement") {
      throw new HostRuntimeError(
        `Host executor received unsupported ${statement.kind}`,
        statement.span,
        "unsupported-statement",
      );
    }

    const effectiveDirection =
      statement.callKind === "call"
        ? executionDirection
        : reverseDirection(executionDirection);
    if (statement.target === "procedure") {
      await this.#executeProcedure(
        statement.name,
        effectiveDirection,
        statement.span,
        activeProcedures,
        runId,
      );
      return;
    }
    await this.#executePrimitive(
      statement.name,
      effectiveDirection,
      statement.span,
      runId,
    );
  }

  async #executePrimitive(
    primitiveName: string,
    direction: Direction,
    span: SourceSpan,
    runId: number,
  ): Promise<void> {
    const primitive = this.primitives.get(primitiveName);
    if (primitive === undefined) {
      throw new HostRuntimeError(
        `Primitive ${JSON.stringify(primitiveName)} is not registered`,
        span,
        "primitive-not-registered",
      );
    }
    const context: HostPrimitiveContext = {
      sessionId: this.sessionId,
      primitiveName,
      direction,
      span,
    };
    this.#emit({
      sessionId: this.sessionId,
      primitiveName,
      direction,
      status: "started",
      span,
    });

    try {
      const receipt =
        direction === "forward"
          ? await this.#forward(primitive, context, runId)
          : await this.#backward(primitiveName, primitive, context);
      this.#emit({
        sessionId: this.sessionId,
        primitiveName,
        direction,
        status: "succeeded",
        span,
        receipt,
      });
    } catch (error) {
      const runtimeError =
        error instanceof HostRuntimeError
          ? error
          : new HostRuntimeError(
              `Primitive ${JSON.stringify(primitiveName)} ${direction} failed: ${errorMessage(error)}`,
              span,
              "primitive-failed",
              { cause: error },
            );
      this.#emit({
        sessionId: this.sessionId,
        primitiveName,
        direction,
        status: "failed",
        span,
        error: runtimeError,
      });
      throw runtimeError;
    }
  }

  async #forward(
    primitive: RegisteredHostPrimitive,
    context: HostPrimitiveContext,
    runId: number,
  ): Promise<unknown> {
    const receipt = await primitive.forward(context);
    this.journal.push({
      sessionId: this.sessionId,
      runId,
      primitiveName: context.primitiveName,
      receipt,
      span: context.span,
    });
    return receipt;
  }

  async #backward(
    primitiveName: string,
    primitive: RegisteredHostPrimitive,
    context: HostPrimitiveContext,
  ): Promise<unknown> {
    const entry = this.journal.peek();
    if (entry === undefined) {
      throw new HostRuntimeError(
        `Receipt journal is empty for primitive ${JSON.stringify(primitiveName)}`,
        context.span,
        "receipt-missing",
      );
    }
    if (entry.sessionId !== this.sessionId) {
      throw new HostRuntimeError(
        `Receipt for primitive ${JSON.stringify(entry.primitiveName)} belongs to another session`,
        context.span,
        "foreign-receipt",
      );
    }
    if (entry.primitiveName !== primitiveName) {
      throw new HostRuntimeError(
        `Receipt journal expected ${JSON.stringify(entry.primitiveName)}, not ${JSON.stringify(primitiveName)}`,
        context.span,
        "receipt-mismatch",
      );
    }

    await primitive.backward(entry.receipt, context);
    this.journal.remove(entry);
    return entry.receipt;
  }

  async #compensate(runId: number): Promise<readonly HostRuntimeError[]> {
    const cleanupErrors: HostRuntimeError[] = [];
    while (true) {
      const entry = this.journal.peek();
      if (
        entry === undefined ||
        entry.sessionId !== this.sessionId ||
        entry.runId !== runId
      ) {
        break;
      }
      try {
        const primitive = this.primitives.get(entry.primitiveName);
        if (primitive === undefined) {
          throw new HostRuntimeError(
            `Primitive ${JSON.stringify(entry.primitiveName)} is not registered`,
            entry.span,
            "primitive-not-registered",
          );
        }
        await this.#executePrimitive(
          entry.primitiveName,
          "backward",
          entry.span,
          runId,
        );
      } catch (error) {
        cleanupErrors.push(
          new HostRuntimeError(
            `Cleanup for primitive ${JSON.stringify(entry.primitiveName)} failed: ${errorMessage(error)}`,
            entry.span,
            "cleanup-failed",
            { cause: error },
          ),
        );
        break;
      }
    }
    return cleanupErrors;
  }

  #emit(event: HostExecutionEvent): void {
    this.#onEvent?.(event);
  }
}
