import {
  PrimitiveRegistry,
  type HostPrimitive,
} from "../host";

export type Receipt = {
  resourceId: string;
};

export type ResourceKind = "network" | "database" | "application";

export type MockResource = {
  id: string;
  kind: ResourceKind;
  label: string;
};

export type DemoPrimitiveEnvironment = {
  readonly resources: MockResource[];
  delay(): Promise<void>;
  nextResourceId(kind: ResourceKind): string;
  shouldFailDeploy(): boolean;
  notify(): void;
};

type ResourceMetadata = {
  kind: ResourceKind;
  label: string;
};

const resourcePrimitive = (
  metadata: ResourceMetadata,
  environment: DemoPrimitiveEnvironment,
  beforeCreate?: () => void,
): HostPrimitive<Receipt> => ({
  forward: async () => {
    await environment.delay();
    beforeCreate?.();
    const resourceId = environment.nextResourceId(metadata.kind);
    environment.resources.push({
      id: resourceId,
      kind: metadata.kind,
      label: metadata.label,
    });
    environment.notify();
    return { resourceId };
  },
  backward: async (receipt) => {
    await environment.delay();
    const resourceIndex = environment.resources.findIndex(
      (resource) => resource.id === receipt.resourceId,
    );
    if (resourceIndex === -1) {
      throw new Error(`Resource ${receipt.resourceId} does not exist.`);
    }
    environment.resources.splice(resourceIndex, 1);
    environment.notify();
  },
});

export const createNetworkPrimitive = (
  environment: DemoPrimitiveEnvironment,
): HostPrimitive<Receipt> =>
  resourcePrimitive({ kind: "network", label: "Network" }, environment);

export const createDatabasePrimitive = (
  environment: DemoPrimitiveEnvironment,
): HostPrimitive<Receipt> =>
  resourcePrimitive({ kind: "database", label: "Database" }, environment);

export const createApplicationPrimitive = (
  environment: DemoPrimitiveEnvironment,
): HostPrimitive<Receipt> =>
  resourcePrimitive(
    { kind: "application", label: "Application" },
    environment,
    () => {
      if (environment.shouldFailDeploy()) {
        throw new Error("Simulated application deployment failure");
      }
    },
  );

export const createDemoPrimitiveRegistry = (
  environment: DemoPrimitiveEnvironment,
): PrimitiveRegistry =>
  new PrimitiveRegistry()
    .register("create_network", createNetworkPrimitive(environment))
    .register("create_database", createDatabasePrimitive(environment))
    .register("deploy_application", createApplicationPrimitive(environment));
