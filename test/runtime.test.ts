import { describe, expect, it } from "vitest";
import { DemoRuntime } from "../src/demo/runtime";

const successfulOperations = (runtime: DemoRuntime, direction: "forward" | "backward") =>
  runtime
    .getSnapshot()
    .events.filter((event) => event.direction === direction && event.status === "succeeded");

describe("DemoRuntime", () => {
  it("creates Network, Database, and Application in forward order", async () => {
    const runtime = new DemoRuntime({ delayMs: 0 });

    await expect(runtime.run()).resolves.toEqual({ status: "succeeded" });

    expect(runtime.getSnapshot().resources.map((resource) => resource.label)).toEqual([
      "Network",
      "Database",
      "Application",
    ]);
    expect(successfulOperations(runtime, "forward").map((event) => event.operation)).toEqual([
      "create_network",
      "create_database",
      "deploy_application",
    ]);
  });

  it("uncalls successful operations in reverse order using their receipts", async () => {
    const runtime = new DemoRuntime({ delayMs: 0 });
    await runtime.run();
    const forwardReceiptIds = successfulOperations(runtime, "forward").map(
      (event) => event.resourceId,
    );

    await runtime.uncall();

    const backwardEvents = successfulOperations(runtime, "backward");
    expect(backwardEvents.map((event) => event.operation)).toEqual([
      "undeploy_application",
      "delete_database",
      "delete_network",
    ]);
    expect(backwardEvents.map((event) => event.resourceId)).toEqual(
      [...forwardReceiptIds].reverse(),
    );
    expect(runtime.getSnapshot().resources).toEqual([]);
    expect(runtime.getSnapshot().canUncall).toBe(false);
  });

  it("automatically cleans up only successful operations after deploy fails", async () => {
    const runtime = new DemoRuntime({ delayMs: 0 });

    const result = await runtime.run({ failDeploy: true });

    expect(result.status).toBe("rolled-back");
    expect(runtime.getSnapshot().resources).toEqual([]);
    expect(successfulOperations(runtime, "backward").map((event) => event.operation)).toEqual([
      "delete_database",
      "delete_network",
    ]);
    expect(
      runtime
        .getSnapshot()
        .events.some(
          (event) =>
            event.operation === "undeploy_application" && event.direction === "backward",
        ),
    ).toBe(false);
  });
});
