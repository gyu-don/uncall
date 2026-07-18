import { PrimitiveRegistry, type HostPrimitive } from "../host";

export type Receipt = {
  resourceId: string;
  generation: number;
  createdFor: string;
  postconditionHash: string;
};

export type ResourceKind =
  | "namespace"
  | "database"
  | "cache"
  | "dataset"
  | "application"
  | "url";

export type MockResource = Receipt & {
  kind: ResourceKind;
  label: string;
};

export type DemoPrimitiveEnvironment = {
  readonly resources: MockResource[];
  delay(): Promise<void>;
  allocate(kind: ResourceKind): { resourceId: string; generation: number };
  createdFor(): string;
  shouldFail(primitiveName: string): boolean;
  notify(): void;
};

export class DemoDriftError extends Error {
  constructor(
    readonly resourceId: string,
    readonly expectedGeneration: number,
    readonly currentGeneration: number,
    readonly expectedPostconditionHash: string,
    readonly currentPostconditionHash: string,
  ) {
    super(
      `Cleanup blocked for ${resourceId}: expected generation ${expectedGeneration}, current generation ${currentGeneration}; manual decision required`,
    );
    this.name = "DemoDriftError";
  }
}

export const postconditionHashFor = (
  kind: ResourceKind,
  resourceId: string,
  generation: number,
  createdFor: string,
): string => `${kind}:${resourceId}:g${generation}:${createdFor}`;

type ResourceMetadata = {
  primitiveName: string;
  kind: ResourceKind;
  label: string;
};

const resourcePrimitive = (
  metadata: ResourceMetadata,
  environment: DemoPrimitiveEnvironment,
): HostPrimitive<Receipt> => ({
  forward: async () => {
    await environment.delay();
    if (environment.shouldFail(metadata.primitiveName)) {
      throw new Error(`Simulated ${metadata.primitiveName} failure`);
    }
    const { resourceId, generation } = environment.allocate(metadata.kind);
    const createdFor = environment.createdFor();
    const postconditionHash = postconditionHashFor(
      metadata.kind,
      resourceId,
      generation,
      createdFor,
    );
    environment.resources.push({
      resourceId,
      generation,
      createdFor,
      postconditionHash,
      kind: metadata.kind,
      label: metadata.label,
    });
    environment.notify();
    return { resourceId, generation, createdFor, postconditionHash };
  },
  backward: async (receipt) => {
    await environment.delay();
    const resourceIndex = environment.resources.findIndex(
      (resource) => resource.resourceId === receipt.resourceId,
    );
    const resource = environment.resources[resourceIndex];
    if (resource === undefined) {
      throw new Error(`Resource ${receipt.resourceId} does not exist.`);
    }
    if (
      resource.generation !== receipt.generation ||
      resource.postconditionHash !== receipt.postconditionHash
    ) {
      throw new DemoDriftError(
        receipt.resourceId,
        receipt.generation,
        resource.generation,
        receipt.postconditionHash,
        resource.postconditionHash,
      );
    }
    environment.resources.splice(resourceIndex, 1);
    environment.notify();
  },
});

const primitiveDefinitions: readonly ResourceMetadata[] = [
  {
    primitiveName: "create_namespace",
    kind: "namespace",
    label: "Namespace",
  },
  {
    primitiveName: "create_database",
    kind: "database",
    label: "Database",
  },
  { primitiveName: "create_cache", kind: "cache", label: "Cache" },
  {
    primitiveName: "seed_preview_data",
    kind: "dataset",
    label: "Preview data",
  },
  {
    primitiveName: "deploy_application",
    kind: "application",
    label: "Application",
  },
  {
    primitiveName: "attach_preview_url",
    kind: "url",
    label: "Preview URL",
  },
];

export const createDemoPrimitiveRegistry = (
  environment: DemoPrimitiveEnvironment,
): PrimitiveRegistry => {
  const registry = new PrimitiveRegistry();
  for (const definition of primitiveDefinitions) {
    registry.register(
      definition.primitiveName,
      resourcePrimitive(definition, environment),
    );
  }
  return registry;
};

export const backwardOperationNames: Readonly<Record<string, string>> = {
  create_namespace: "delete_namespace",
  create_database: "delete_database",
  create_cache: "delete_cache",
  seed_preview_data: "unseed_preview_data",
  deploy_application: "undeploy_application",
  attach_preview_url: "detach_preview_url",
};
