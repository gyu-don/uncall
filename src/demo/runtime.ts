import {
  compileHostModule,
  HostExecutor,
  type HostExecutionEvent,
} from "../host";
import {
  createDemoPrimitiveRegistry,
  type MockResource,
  type ResourceKind,
} from "./primitives";
import { DEMO_SOURCE } from "./source";

export type { MockResource, Receipt, ResourceKind } from "./primitives";

export type DemoEvent = {
  sequence: number;
  direction: "forward" | "backward";
  operation: string;
  status: "started" | "succeeded" | "failed";
  resourceId?: string;
  message?: string;
};

export type DemoSnapshot = {
  resources: readonly MockResource[];
  events: readonly DemoEvent[];
  isBusy: boolean;
  canUncall: boolean;
};

export type RunResult =
  | { status: "succeeded" }
  | { status: "compile-failed"; error: string }
  | {
      status: "rolled-back";
      error: string;
      cleanupErrors: readonly string[];
    };

const backwardNames: Readonly<Record<string, string>> = {
  create_network: "delete_network",
  create_database: "delete_database",
  deploy_application: "undeploy_application",
};

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

export class DemoRuntime {
  readonly #resources: MockResource[] = [];
  readonly #events: DemoEvent[] = [];
  readonly #listeners = new Set<(snapshot: DemoSnapshot) => void>();
  readonly #delayMs: number;
  readonly #registry;
  #executor: HostExecutor | undefined;
  #isBusy = false;
  #failDeploy = false;
  #nextResourceId = 1;
  #nextSequence = 1;

  constructor(options: { delayMs?: number } = {}) {
    this.#delayMs = options.delayMs ?? 320;
    this.#registry = createDemoPrimitiveRegistry({
      resources: this.#resources,
      delay: () => this.#delay(),
      nextResourceId: (kind) => `${kind}-${this.#nextResourceId++}`,
      shouldFailDeploy: () => this.#failDeploy,
      notify: () => this.#notify(),
    });
  }

  getSnapshot(): DemoSnapshot {
    return {
      resources: this.#resources.map((resource) => ({ ...resource })),
      events: this.#events.map((event) => ({ ...event })),
      isBusy: this.#isBusy,
      canUncall: (this.#executor?.journal.length ?? 0) > 0,
    };
  }

  subscribe(listener: (snapshot: DemoSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.#listeners.delete(listener);
  }

  async run(
    options: { source?: string; failDeploy?: boolean } = {},
  ): Promise<RunResult> {
    this.#assertIdle();
    if ((this.#executor?.journal.length ?? 0) > 0) {
      throw new Error("Uncall the current deployment before running again.");
    }

    this.#setBusy(true);
    this.#failDeploy = options.failDeploy ?? false;
    try {
      let executor: HostExecutor;
      try {
        const module = compileHostModule(options.source ?? DEMO_SOURCE, this.#registry);
        executor = new HostExecutor(module, this.#registry, {
          onEvent: (event) => this.#recordHostEvent(event),
        });
      } catch (error) {
        this.#executor = undefined;
        return { status: "compile-failed", error: messageOf(error) };
      }

      this.#executor = executor;
      const result = await executor.call("deploy");
      if (result.status === "succeeded") return { status: "succeeded" };
      return {
        status: "rolled-back",
        error: result.error.message,
        cleanupErrors: result.cleanupErrors.map((error) => error.message),
      };
    } finally {
      this.#failDeploy = false;
      this.#setBusy(false);
    }
  }

  async uncall(): Promise<void> {
    this.#assertIdle();
    const executor = this.#executor;
    if (executor === undefined || executor.journal.length === 0) {
      throw new Error("There is no deployment to uncall.");
    }

    this.#setBusy(true);
    try {
      const result = await executor.uncall("deploy");
      if (result.status === "failed") throw result.error;
    } finally {
      this.#setBusy(false);
    }
  }

  #recordHostEvent(event: HostExecutionEvent): void {
    const resourceId = receiptResourceId(event.receipt);
    this.#events.push({
      sequence: this.#nextSequence++,
      direction: event.direction,
      operation:
        event.direction === "forward"
          ? event.primitiveName
          : (backwardNames[event.primitiveName] ?? event.primitiveName),
      status: event.status,
      ...(resourceId === undefined ? {} : { resourceId }),
      ...(event.error === undefined ? {} : { message: event.error.message }),
    });
    this.#notify();
  }

  #assertIdle(): void {
    if (this.#isBusy) throw new Error("The runtime is already executing.");
  }

  #setBusy(isBusy: boolean): void {
    this.#isBusy = isBusy;
    this.#notify();
  }

  async #delay(): Promise<void> {
    if (this.#delayMs <= 0) return;
    await new Promise<void>((resolve) => setTimeout(resolve, this.#delayMs));
  }

  #notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.#listeners) listener(snapshot);
  }
}
