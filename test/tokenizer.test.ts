import { describe, expect, it } from "vitest";
import { TokenizeError, tokenize } from "../src/janus/tokenizer";

describe("tokenize", () => {
  it("tokenizes keywords, identifiers, and punctuation with source positions", () => {
    const tokens = tokenize("procedure deploy()\n  uncall cleanup_2()");

    expect(tokens.map((token) => token.kind)).toEqual([
      "procedure",
      "identifier",
      "leftParen",
      "rightParen",
      "uncall",
      "identifier",
      "leftParen",
      "rightParen",
      "eof",
    ]);
    expect(tokens[4]?.span.start).toEqual({ offset: 21, line: 2, column: 3 });
  });

  it("reports an invalid token with line and column", () => {
    expect(() => tokenize("procedure p()\ncall @bad()\n")).toThrowError(TokenizeError);
    try {
      tokenize("procedure p()\ncall @bad()\n");
    } catch (error) {
      expect(error).toMatchObject({
        span: { start: { line: 2, column: 6 } },
      });
    }
  });
});
