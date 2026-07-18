import { describe, expect, it } from "vitest";
import { parse } from "../src/janus/parser";
import {
  linkNames,
  NameResolutionError,
  resolveNames,
} from "../src/janus/resolver";

describe("resolveNames", () => {
  it("distinguishes user procedures from registered primitives", () => {
    const module = parse(`procedure deploy()\ncall prepare()\ncall create_network()\nprocedure prepare()`);

    const resolved = resolveNames(module, new Set(["create_network"]));

    expect(resolved.procedures[0]?.body.map((statement) => statement.target)).toEqual([
      "procedure",
      "primitive",
    ]);
  });

  it("collects undefined-name diagnostics with source locations", () => {
    const module = parse("procedure deploy()\ncall missing()");

    expect(() => resolveNames(module, new Set())).toThrowError(NameResolutionError);
    try {
      resolveNames(module, new Set());
    } catch (error) {
      expect(error).toMatchObject({
        diagnostics: [
          {
            message: expect.stringContaining("Undefined procedure or primitive"),
            span: { start: { line: 2, column: 6 } },
          },
        ],
      });
    }
  });

  it("rejects duplicate procedure names", () => {
    const module = parse("procedure same()\nprocedure same()");

    expect(() => resolveNames(module, new Set())).toThrowError("Duplicate procedure");
  });

  it("normalizes primitive names and rejects procedure/primitive collisions", () => {
    const module = parse("PROCEDURE Deploy\nCALL CREATE_NETWORK");
    const resolved = linkNames(module, [
      { name: "create_network", hasForward: true, hasBackward: true },
    ]);

    expect(resolved.procedures[0]?.body[0]).toMatchObject({
      name: "create_network",
      target: "primitive",
    });
    expect(() =>
      linkNames(parse("procedure SAME"), [
        { name: "same", hasForward: true, hasBackward: true },
      ]),
    ).toThrowError(/conflicts with a host primitive/);
  });

  it("requires both primitive directions at link time", () => {
    expect(() =>
      linkNames(parse("procedure deploy()\ncall create()"), [
        { name: "create", hasForward: true, hasBackward: false },
      ]),
    ).toThrowError(/must provide both directions/);
  });
});
