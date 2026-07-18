import { describe, expect, it } from "vitest";
import { DEMO_SOURCE } from "../src/demo/source";
import { ParseError, parse } from "../src/janus/parser";

describe("parse", () => {
  it("parses the standard demo into a source-spanned AST", () => {
    const module = parse(DEMO_SOURCE);

    expect(module.procedures).toHaveLength(1);
    expect(module.procedures[0]).toMatchObject({
      kind: "ProcedureDeclaration",
      name: "deploy",
      body: [
        { kind: "CallStatement", callKind: "call", name: "create_network" },
        { kind: "CallStatement", callKind: "call", name: "create_database" },
        { kind: "CallStatement", callKind: "call", name: "deploy_application" },
      ],
      span: { start: { line: 1, column: 1 }, end: { line: 4, column: 30 } },
    });
  });

  it("parses multiple procedures and both call directions without indentation semantics", () => {
    const module = parse(`procedure cleanup()\nuncall release()\nprocedure deploy()\ncall cleanup()`);

    expect(module.procedures.map((procedure) => procedure.name)).toEqual([
      "cleanup",
      "deploy",
    ]);
    expect(module.procedures[0]?.body[0]).toMatchObject({
      callKind: "uncall",
      name: "release",
    });
  });

  it.each([
    ["", "Expected at least one procedure"],
    ["procedure deploy(", 'Expected ")"'],
    ["procedure deploy()\nthing()", 'Expected "call" or "uncall"'],
  ])("rejects incomplete or invalid source %#", (source, message) => {
    expect(() => parse(source)).toThrowError(ParseError);
    expect(() => parse(source)).toThrowError(message);
  });
});
