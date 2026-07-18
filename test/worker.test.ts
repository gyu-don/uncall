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
    expect(html).toContain("One program.");
    expect(html).toContain('<textarea class="source-editor" id="pure-source"');
    expect(html).toContain('<textarea class="source-editor codec-source" id="codec-source"');
    expect(html).toContain('<textarea class="source-editor tree-source" id="tree-source"');
    expect(html).toContain("ソートして元に戻す");
    expect(html).toContain("sort.janus · editable");
    expect(html).toContain("procedure bubble_pass");
    expect(html).toContain("trace[6]");
    expect(html).toContain("EncodeしてDecodeする");
    expect(html).toContain("木をPathにして戻す");
    expect(html).toContain("encode.janus · no decoder");
    expect(html).toContain("encode_path.janus · editable");
    expect(html).toContain('data-tree-node="6"');
    expect(html).toContain('data-testid="tree-call"');
    expect(html).toContain("No generated inverse program. The same AST runs backward.");
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
