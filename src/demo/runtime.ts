import { demoPlan, type DemoStep } from "./source";

export type Receipt = {
  resourceId: string;
};

export type Primitive = {
  forward(): Promise<Receipt>;
  backward(receipt: Receipt): Promise<void>;
};

export type ResourceKind = "network" | "database" | "application";

export type MockResource = {
  id: string;
  kind: ResourceKind;
  label: string;
};

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
  | { status: "rolled-back"; error: string };

type StackEntry = {
  primitiveName: DemoStep;
  receipt: Receipt;
};

type PrimitiveMetadata = {
  backwardName: string;
  kind: ResourceKind;
  label: string;
};

const metadata: Record<DemoStep, PrimitiveMetadata> = {
  create_network: {
    backwardName: "delete_network",
    kind: "network",
    label: "Network",
  },
  create_database: {
    backwardName: "delete_database",
    kind: "database",
    label: "Database",
  },
  deploy_application: {
    backwardName: "undeploy_application",
    kind: "application",
    label: "Application",
  },
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class DemoRuntime {
  readonly #resources: MockResource[] = [];
  readonly #events: DemoEvent[] = [];
  readonly #stack: StackEntry[] = [];
  readonly #primitives: Record<DemoStep, Primitive>;
  readonly #listeners = new Set<(snapshot: DemoSnapshot) => void>();
  readonly #delayMs: number;
  #isBusy = false;
  #nextResourceId = 1;
  #nextSequence = 1;

  constructor(options: { delayMs?: number } = {}) {
    this.#delayMs = options.delayMs ?? 320;
    this.#primitives = Object.fromEntries(
      demoPlan.map((step) => [step, this.#createPrimitive(step)]),
    ) as Record<DemoStep, Primitive>;
  }

  getSnapshot(): DemoSnapshot {
    return {
      resources: this.#resources.map((resource) => ({ ...resource })),
      events: this.#events.map((event) => ({ ...event })),
      isBusy: this.#isBusy,
      canUncall: this.#stack.length > 0,
    };
  }

  subscribe(listener: (snapshot: DemoSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.#listeners.delete(listener);
  }

  async run(options: { failDeploy?: boolean } = {}): Promise<RunResult> {
    this.#assertIdle();
    if (this.#stack.length > 0) {
      throw new Error("Uncall the current deployment before running again.");
    }

    this.#setBusy(true);
    try {
      for (const primitiveName of demoPlan) {
        this.#record("forward", primitiveName, "started");

        try {
          if (primitiveName === "deploy_application" && options.failDeploy) {
            await this.#delay();
            throw new Error("Simulated application deployment failure");
          }

          const receipt = await this.#primitives[primitiveName].forward();
          this.#stack.push({ primitiveName, receipt });
          this.#record("forward", primitiveName, "succeeded", receipt.resourceId);
        } catch (error) {
          const message = errorMessage(error);
          this.#record("forward", primitiveName, "failed", undefined, message);
          await this.#cleanupStack();
          return { status: "rolled-back", error: message };
        }
      }

      return { status: "succeeded" };
    } finally {
      this.#setBusy(false);
    }
  }

  async uncall(): Promise<void> {
    this.#assertIdle();
    if (this.#stack.length === 0) {
      throw new Error("There is no deployment to uncall.");
    }

    this.#setBusy(true);
    try {
      await this.#cleanupStack();
    } finally {
      this.#setBusy(false);
    }
  }

  #createPrimitive(primitiveName: DemoStep): Primitive {
    const primitiveMetadata = metadata[primitiveName];

    return {
      forward: async () => {
        await this.#delay();
        const resourceId = `${primitiveMetadata.kind}-${this.#nextResourceId++}`;
        this.#resources.push({
          id: resourceId,
          kind: primitiveMetadata.kind,
          label: primitiveMetadata.label,
        });
        this.#notify();
        return { resourceId };
      },
      backward: async (receipt) => {
        await this.#delay();
        const resourceIndex = this.#resources.findIndex(
          (resource) => resource.id === receipt.resourceId,
        );
        if (resourceIndex === -1) {
          throw new Error(`Resource ${receipt.resourceId} does not exist.`);
        }
        this.#resources.splice(resourceIndex, 1);
        this.#notify();
      },
    };
  }

  async #cleanupStack(): Promise<void> {
    while (this.#stack.length > 0) {
      const entry = this.#stack.pop();
      if (entry === undefined) break;

      const backwardName = metadata[entry.primitiveName].backwardName;
      this.#record("backward", backwardName, "started", entry.receipt.resourceId);
      try {
        await this.#primitives[entry.primitiveName].backward(entry.receipt);
        this.#record(
          "backward",
          backwardName,
          "succeeded",
          entry.receipt.resourceId,
        );
      } catch (error) {
        this.#record(
          "backward",
          backwardName,
          "failed",
          entry.receipt.resourceId,
          errorMessage(error),
        );
        throw error;
      }
    }
  }

  #record(
    direction: DemoEvent["direction"],
    operation: string,
    status: DemoEvent["status"],
    resourceId?: string,
    message?: string,
  ): void {
    this.#events.push({
      sequence: this.#nextSequence++,
      direction,
      operation,
      status,
      ...(resourceId === undefined ? {} : { resourceId }),
      ...(message === undefined ? {} : { message }),
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
