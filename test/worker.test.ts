import { describe, expect, it } from "vitest";
import { createWorker } from "../src/worker";

describe("Cloudflare Worker", () => {
  const app = createWorker("console.log('browser bundle');");

  it("serves the demo shell", async () => {
    const response = await app.request("/");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("UNCALL");
    expect(html).toContain('<textarea class="source-editor" id="source"');
    expect(html).toContain("Phase 2 · host");
  });

  it("serves browser JavaScript", async () => {
    const response = await app.request("/app.js");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/javascript");
    await expect(response.text()).resolves.toContain("browser bundle");
  });

  it("reports deployment health", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      service: "uncall",
      phases: [0, 1, 2],
    });
  });
});
