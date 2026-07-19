import { describe, expect, it } from "vitest";
import { createWorker } from "../src/worker";

describe("Cloudflare Worker", () => {
  const app = createWorker(
    "console.log('browser bundle');",
    "console.log('quantum browser bundle');",
  );

  it("serves the demo shell", async () => {
    const response = await app.request("/");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("UNCALL");
    expect(html).toContain("One program.");
    expect(html).toContain('<textarea class="source-editor" id="pure-source"');
    expect(html).toContain('<textarea class="source-editor codec-source" id="codec-source"');
    expect(html).toContain('<textarea class="source-editor tree-source" id="tree-source"');
    expect(html).toContain("Sort, then restore");
    expect(html).toContain("sort.janus · editable");
    expect(html).toContain("procedure bubble_pass");
    expect(html).toContain("trace[6]");
    expect(html).toContain("Encode with one procedure");
    expect(html).toContain("Store a tree leaf as a path");
    expect(html).toContain("encode.janus · editable");
    expect(html).toContain("encode_path.janus · editable");
    expect(html).toContain('data-tree-node="6"');
    expect(html).toContain('data-testid="tree-call"');
    expect(html).toContain('data-tree-path-bit="0"');
    expect(html).toContain("One procedure · two directions");
    expect(html).toContain('href="/quantum"');
  });

  it("serves browser JavaScript", async () => {
    const response = await app.request("/app.js");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/javascript");
    await expect(response.text()).resolves.toContain("browser bundle");
  });

  it("serves the separate accessible quantum demo and bundle", async () => {
    const response = await app.request("/quantum");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("Run a circuit forward.");
    expect(html).toContain('role="tablist"');
    expect(html).toContain('id="qft-tab"');
    expect(html).toContain('id="adder-tab"');
    expect(html).toContain('id="qft-output"');
    expect(html).toContain('id="adder-output-b"');
    expect(html).toContain("A number becomes phase.");
    expect(html).toContain("qft.janus · executed");
    expect(html).toContain("add.janus · executed");
    expect(html).not.toContain("Clifford+T");
    expect(html).not.toContain("T-count");
    expect(html).toContain('src="/quantum/app.js"');

    const bundle = await app.request("/quantum/app.js");
    expect(bundle.status).toBe(200);
    expect(bundle.headers.get("content-type")).toContain("text/javascript");
    await expect(bundle.text()).resolves.toContain("quantum browser bundle");
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
