import {
  compileHostModule,
  deriveHostPlan,
  hostPlanHash,
  HostExecutor,
  ReceiptJournal,
  type HostExecutionEvent,
  type HostPlanStep,
  type ReceiptJournalEntry,
} from "../host";
import {
  backwardOperationNames,
  createDemoPrimitiveRegistry,
  DemoDriftError,
  postconditionHashFor,
  type MockResource,
  type ResourceKind,
} from "./primitives";
import { DEMO_SOURCE, PREVIEW_PROCEDURE } from "./source";

export type { MockResource, Receipt, ResourceKind } from "./primitives";

export type DemoEvent = {
  sequence: number;
  process: "runtime-a" | "runtime-b" | "external";
  direction: "forward" | "backward" | "external";
  operation: string;
  status: "started" | "succeeded" | "failed";
  resourceId?: string;
  message?: string;
};

export type DemoBlockedReason = {
  operation: string;
  resourceId: string;
  expectedGeneration: number;
  currentGeneration: number;
  expectedPostconditionHash: string;
  currentPostconditionHash: string;
  message: string;
};

export type DemoExecutionStatus = "live" | "review" | "blocked" | "completed";

export type DemoExecutionRecord = {
  version: 1;
  executionId: string;
  procedureName: string;
  source: string;
  planHash: string;
  sessionId: string;
  prNumber: number;
  createdAt: string;
  status: DemoExecutionStatus;
  receipts: readonly ReceiptJournalEntry[];
  blockedReason?: DemoBlockedReason;
  completedAt?: string;
};

export type DemoPlanStep = HostPlanStep & {
  operation: string;
  receipt?: unknown;
};

export type DemoSourceAnalysis =
  | {
      status: "valid";
      planHash: string;
      forward: readonly DemoPlanStep[];
      backward: readonly DemoPlanStep[];
    }
  | { status: "invalid"; error: string };

export type DemoStage =
  | "authoring"
  | "running"
  | "live"
  | "review"
  | "reversing"
  | "blocked"
  | "completed"
  | "rolled-back";

export type DemoSnapshot = {
  resources: readonly MockResource[];
  events: readonly DemoEvent[];
  execution?: DemoExecutionRecord;
  inversePlan: readonly DemoPlanStep[];
  stage: DemoStage;
  isBusy: boolean;
  canOpen: boolean;
  canResume: boolean;
  canUncall: boolean;
  canDrift: boolean;
};

export type RunResult =
  | { status: "succeeded"; execution?: DemoExecutionRecord }
  | { status: "compile-failed"; error: string }
  | {
      status: "rolled-back";
      error: string;
      cleanupErrors: readonly string[];
    };

export type UncallResult =
  | { status: "succeeded" }
  | { status: "blocked"; reason: DemoBlockedReason }
  | { status: "failed"; error: string };

export interface DemoStateStore {
  load(): string | null;
  save(value: string): void;
  clear(): void;
}

export class MemoryDemoStateStore implements DemoStateStore {
  #value: string | null = null;

  load(): string | null {
    return this.#value;
  }

  save(value: string): void {
    this.#value = value;
  }

  clear(): void {
    this.#value = null;
  }
}

export class WebDemoStateStore implements DemoStateStore {
  constructor(
    private readonly storage: Storage,
    private readonly key = "uncall.preview-demo.v1",
  ) {}

  load(): string | null {
    return this.storage.getItem(this.key);
  }

  save(value: string): void {
    this.storage.setItem(this.key, value);
  }

  clear(): void {
    this.storage.removeItem(this.key);
  }
}

type PersistedDemoState = {
  version: 1;
  resources: MockResource[];
  events: DemoEvent[];
  execution: DemoExecutionRecord | null;
  nextResourceId: number;
  nextGeneration: number;
  nextExecutionId: number;
  nextSequence: number;
};

const emptyState = (): PersistedDemoState => ({
  version: 1,
  resources: [],
  events: [],
  execution: null,
  nextResourceId: 1,
  nextGeneration: 1,
  nextExecutionId: 1,
  nextSequence: 1,
});

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const receiptResourceId = (receipt: unknown): string | undefined => {
  if (
    typeof receipt === "object" &&
    receipt !== null &&
    "resourceId" in receipt &&
    typeof receipt.resourceId === "string"
  ) {
    return receipt.resourceId;
  }
  return undefined;
};

const findDriftError = (error: unknown): DemoDriftError | undefined => {
  let current = error;
  const seen = new Set<unknown>();
  while (current instanceof Error && !seen.has(current)) {
    if (current instanceof DemoDriftError) return current;
    seen.add(current);
    current = current.cause;
  }
  return undefined;
};

const clone = <Value>(value: Value): Value =>
  JSON.parse(JSON.stringify(value)) as Value;

const operationName = (step: HostPlanStep): string =>
  step.direction === "forward"
    ? step.primitiveName
    : (backwardOperationNames[step.primitiveName] ?? step.primitiveName);

const loadState = (store: DemoStateStore): PersistedDemoState => {
  const serialized = store.load();
  if (serialized === null) return emptyState();
  try {
    const parsed = JSON.parse(serialized) as Partial<PersistedDemoState>;
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.resources) ||
      !Array.isArray(parsed.events)
    ) {
      return emptyState();
    }
    return parsed as PersistedDemoState;
  } catch {
    return emptyState();
  }
};

export class DemoRuntime {
  readonly #listeners = new Set<(snapshot: DemoSnapshot) => void>();
  readonly #delayMs: number;
  readonly #store: DemoStateStore;
  readonly #now: () => Date;
  readonly #registry;
  #state: PersistedDemoState;
  #executor: HostExecutor | undefined;
  #isBusy = false;
  #stage: DemoStage;
  #failAt: string | undefined;
  #createdFor = "PR #418";
  #process: "runtime-a" | "runtime-b" = "runtime-a";

  constructor(
    options: {
      delayMs?: number;
      store?: DemoStateStore;
      now?: () => Date;
    } = {},
  ) {
    this.#delayMs = options.delayMs ?? 240;
    this.#store = options.store ?? new MemoryDemoStateStore();
    this.#now = options.now ?? (() => new Date());
    this.#state = loadState(this.#store);
    this.#stage = this.#stageFromExecution();

    const runtime = this;
    this.#registry = createDemoPrimitiveRegistry({
      get resources() {
        return runtime.#state.resources;
      },
      delay: () => this.#delay(),
      allocate: (kind) => {
        const prSlug = this.#createdFor.replaceAll(/\D/gu, "") || "preview";
        const resourceId = `${kind}-pr${prSlug}-${String(this.#state.nextResourceId++).padStart(2, "0")}`;
        return {
          resourceId,
          generation: this.#state.nextGeneration++,
        };
      },
      createdFor: () => this.#createdFor,
      shouldFail: (primitiveName) => this.#failAt === primitiveName,
      notify: () => {
        this.#persist();
        this.#notify();
      },
    });
  }

  inspectSource(source: string): DemoSourceAnalysis {
    try {
      const module = compileHostModule(source, this.#registry);
      const forward = deriveHostPlan(module, PREVIEW_PROCEDURE, "forward");
      const backward = deriveHostPlan(module, PREVIEW_PROCEDURE, "backward");
      return {
        status: "valid",
        planHash: hostPlanHash(PREVIEW_PROCEDURE, forward, backward),
        forward: forward.map((step) => ({ ...step, operation: operationName(step) })),
        backward: backward.map((step) => ({ ...step, operation: operationName(step) })),
      };
    } catch (error) {
      return { status: "invalid", error: messageOf(error) };
    }
  }

  getSnapshot(): DemoSnapshot {
    const execution = this.#state.execution;
    const inversePlan =
      execution === null ? [] : this.#inversePlanWithReceipts(execution);
    return {
      resources: clone(this.#state.resources),
      events: clone(this.#state.events),
      ...(execution === null ? {} : { execution: clone(execution) }),
      inversePlan,
      stage: this.#stage,
      isBusy: this.#isBusy,
      canOpen: !this.#isBusy &&
        (execution === null || execution.status === "completed"),
      canResume: !this.#isBusy && execution?.status === "live",
      canUncall:
        !this.#isBusy &&
        (execution?.status === "review" || execution?.status === "blocked") &&
        execution.receipts.length > 0,
      canDrift:
        !this.#isBusy &&
        (execution?.status === "live" || execution?.status === "review") &&
        this.#state.resources.some((resource) => resource.kind === "database"),
    };
  }

  subscribe(listener: (snapshot: DemoSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.#listeners.delete(listener);
  }

  async openPreview(
    options: {
      source?: string;
      failAt?: string;
      failDeploy?: boolean;
      prNumber?: number;
    } = {},
  ): Promise<RunResult> {
    this.#assertIdle();
    if (!this.getSnapshot().canOpen) {
      throw new Error("Reset or finish the current preview before opening another PR.");
    }

    const source = options.source ?? DEMO_SOURCE;
    const analysis = this.inspectSource(source);
    if (analysis.status === "invalid") {
      return { status: "compile-failed", error: analysis.error };
    }

    this.#setBusy(true, "running");
    this.#process = "runtime-a";
    this.#failAt = options.failAt ??
      (options.failDeploy === true ? "deploy_application" : undefined);
    const prNumber = options.prNumber ?? 418;
    this.#createdFor = `PR #${prNumber}`;
    const executionNumber = this.#state.nextExecutionId++;
    const executionId = `exec_${prNumber}_${String(executionNumber).padStart(2, "0")}`;
    const sessionId = `session:${executionId}`;

    try {
      const module = compileHostModule(source, this.#registry);
      const executor = new HostExecutor(module, this.#registry, {
        sessionId,
        onEvent: (event) => this.#recordHostEvent(event),
      });
      this.#executor = executor;
      const result = await executor.call(PREVIEW_PROCEDURE);
      if (result.status === "failed") {
        this.#executor = undefined;
        this.#stage = "rolled-back";
        this.#persist();
        return {
          status: "rolled-back",
          error: result.error.message,
          cleanupErrors: result.cleanupErrors.map((error) => error.message),
        };
      }

      const execution: DemoExecutionRecord = {
        version: 1,
        executionId,
        procedureName: PREVIEW_PROCEDURE,
        source,
        planHash: analysis.planHash,
        sessionId,
        prNumber,
        createdAt: this.#now().toISOString(),
        status: "live",
        receipts: executor.journal.entries,
      };
      this.#state.execution = execution;
      this.#executor = undefined;
      this.#stage = "live";
      this.#persist();
      return { status: "succeeded", execution: clone(execution) };
    } finally {
      this.#failAt = undefined;
      this.#setBusy(false);
    }
  }

  async run(
    options: {
      source?: string;
      failAt?: string;
      failDeploy?: boolean;
      prNumber?: number;
    } = {},
  ): Promise<RunResult> {
    const result = await this.openPreview(options);
    return result.status === "succeeded" ? { status: "succeeded" } : result;
  }

  resume(executionId?: string): DemoExecutionRecord {
    this.#assertIdle();
    const execution = this.#state.execution;
    if (execution === null || execution.status === "completed") {
      throw new Error("There is no live execution record to resume.");
    }
    if (executionId !== undefined && execution.executionId !== executionId) {
      throw new Error(`Execution ${executionId} was not found.`);
    }

    const analysis = this.inspectSource(execution.source);
    if (analysis.status === "invalid") {
      throw new Error(`Saved source no longer links: ${analysis.error}`);
    }
    if (analysis.planHash !== execution.planHash) {
      throw new Error(
        `Plan hash mismatch: saved ${execution.planHash}, derived ${analysis.planHash}`,
      );
    }

    const module = compileHostModule(execution.source, this.#registry);
    this.#process = "runtime-b";
    this.#executor = new HostExecutor(module, this.#registry, {
      sessionId: execution.sessionId,
      journal: new ReceiptJournal(execution.receipts),
      onEvent: (event) => this.#recordHostEvent(event),
    });
    execution.status = "review";
    delete execution.blockedReason;
    this.#stage = "review";
    this.#persist();
    this.#notify();
    return clone(execution);
  }

  async uncall(): Promise<UncallResult> {
    this.#assertIdle();
    const execution = this.#state.execution;
    if (execution === null || execution.receipts.length === 0) {
      throw new Error("There is no preview execution to uncall.");
    }
    if (this.#executor === undefined) this.resume(execution.executionId);
    const executor = this.#executor;
    if (executor === undefined) throw new Error("Runtime B could not be restored.");

    this.#setBusy(true, "reversing");
    try {
      const result = await executor.uncallRecorded();
      execution.receipts = executor.journal.entries;
      if (result.status === "succeeded") {
        execution.status = "completed";
        execution.completedAt = this.#now().toISOString();
        delete execution.blockedReason;
        this.#stage = "completed";
        this.#persist();
        return { status: "succeeded" };
      }

      const drift = findDriftError(result.error);
      if (drift !== undefined) {
        const reason: DemoBlockedReason = {
          operation: "delete_database",
          resourceId: drift.resourceId,
          expectedGeneration: drift.expectedGeneration,
          currentGeneration: drift.currentGeneration,
          expectedPostconditionHash: drift.expectedPostconditionHash,
          currentPostconditionHash: drift.currentPostconditionHash,
          message: drift.message,
        };
        execution.status = "blocked";
        execution.blockedReason = reason;
        this.#stage = "blocked";
        this.#persist();
        return { status: "blocked", reason: clone(reason) };
      }

      execution.status = "blocked";
      this.#stage = "blocked";
      this.#persist();
      return { status: "failed", error: result.error.message };
    } finally {
      this.#setBusy(false);
    }
  }

  simulateDatabaseDrift(): MockResource {
    this.#assertIdle();
    if (!this.getSnapshot().canDrift) {
      throw new Error("A live database is required before simulating drift.");
    }
    const database = this.#state.resources.find(
      (resource) => resource.kind === "database",
    );
    if (database === undefined) throw new Error("Database resource was not found.");
    database.generation += 1;
    database.postconditionHash = postconditionHashFor(
      database.kind,
      database.resourceId,
      database.generation,
      database.createdFor,
    );
    this.#state.events.push({
      sequence: this.#state.nextSequence++,
      process: "external",
      direction: "external",
      operation: "external_database_change",
      status: "succeeded",
      resourceId: database.resourceId,
      message: `generation → ${database.generation}`,
    });
    this.#persist();
    this.#notify();
    return clone(database);
  }

  reset(): void {
    this.#assertIdle();
    this.#store.clear();
    this.#state = emptyState();
    this.#executor = undefined;
    this.#process = "runtime-a";
    this.#stage = "authoring";
    this.#persist();
    this.#notify();
  }

  #inversePlanWithReceipts(execution: DemoExecutionRecord): DemoPlanStep[] {
    const analysis = this.inspectSource(execution.source);
    if (analysis.status === "invalid") return [];
    const receiptStack = [...execution.receipts].reverse();
    const remainingCount = execution.receipts.length;
    return analysis.backward.slice(analysis.backward.length - remainingCount).map(
      (step, index) => ({
        ...step,
        ...(receiptStack[index] === undefined
          ? {}
          : { receipt: clone(receiptStack[index].receipt) }),
      }),
    );
  }

  #recordHostEvent(event: HostExecutionEvent): void {
    const resourceId = receiptResourceId(event.receipt);
    this.#state.events.push({
      sequence: this.#state.nextSequence++,
      process: this.#process,
      direction: event.direction,
      operation:
        event.direction === "forward"
          ? event.primitiveName
          : (backwardOperationNames[event.primitiveName] ?? event.primitiveName),
      status: event.status,
      ...(resourceId === undefined ? {} : { resourceId }),
      ...(event.error === undefined ? {} : { message: event.error.message }),
    });
    const execution = this.#state.execution;
    if (execution !== null && this.#executor !== undefined) {
      execution.receipts = this.#executor.journal.entries;
    }
    this.#persist();
    this.#notify();
  }

  #stageFromExecution(): DemoStage {
    const status = this.#state.execution?.status;
    if (status === "live") return "live";
    if (status === "review") return "review";
    if (status === "blocked") return "blocked";
    if (status === "completed") return "completed";
    return "authoring";
  }

  #assertIdle(): void {
    if (this.#isBusy) throw new Error("The runtime is already executing.");
  }

  #setBusy(isBusy: boolean, stage?: DemoStage): void {
    this.#isBusy = isBusy;
    if (stage !== undefined) this.#stage = stage;
    this.#notify();
  }

  async #delay(): Promise<void> {
    if (this.#delayMs <= 0) return;
    await new Promise<void>((resolve) => setTimeout(resolve, this.#delayMs));
  }

  #persist(): void {
    this.#store.save(JSON.stringify(this.#state));
  }

  #notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.#listeners) listener(snapshot);
  }
}
