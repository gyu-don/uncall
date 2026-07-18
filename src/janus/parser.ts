import type {
  ArrayLocation,
  BinaryOperator,
  CallStatement,
  Expression,
  IfStatement,
  JanusModule,
  Location,
  LoopStatement,
  ProcedureDeclaration,
  Statement,
  UnaryOperator,
  VariableDeclaration,
} from "./ast";
import { mergeSpans, type SourceSpan } from "./span";
import { tokenize, type Token, type TokenKind } from "./tokenizer";

const tokenLabel: Partial<Record<TokenKind, string>> = {
  procedure: '"procedure"',
  call: '"call"',
  uncall: '"uncall"',
  identifier: "an identifier",
  integer: "an integer",
  leftParen: '"("',
  rightParen: '")"',
  leftBracket: '"["',
  rightBracket: '"]"',
  then: '"then"',
  else: '"else"',
  fi: '"fi"',
  do: '"do"',
  loop: '"loop"',
  until: '"until"',
  eof: "end of input",
};

const binaryOperators: Partial<Record<TokenKind, BinaryOperator>> = {
  plus: "+",
  minus: "-",
  star: "*",
  slash: "/",
  backslash: "\\",
  bang: "!",
  ampersand: "&",
  pipe: "|",
  equal: "=",
  hash: "#",
  less: "<",
  greater: ">",
  lessEqual: "<=",
  greaterEqual: ">=",
};

const normalizeName = (name: string): string => name.toLowerCase();

export class ParseError extends SyntaxError {
  constructor(
    message: string,
    readonly span: SourceSpan,
  ) {
    super(`${message} at ${span.start.line}:${span.start.column}`);
    this.name = "ParseError";
  }
}

class Parser {
  #index = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  parseModule(): JanusModule {
    if (this.#check("eof")) {
      throw new ParseError("Expected at least one procedure", this.#peek().span);
    }

    const declarations: VariableDeclaration[] = [];
    while (this.#check("identifier")) declarations.push(this.#parseDeclaration());

    if (!this.#check("procedure")) {
      throw new ParseError(
        `Expected "procedure", found ${this.#describe(this.#peek())}`,
        this.#peek().span,
      );
    }

    const procedures: ProcedureDeclaration[] = [];
    while (!this.#check("eof")) procedures.push(this.#parseProcedure());

    const first = declarations[0] ?? procedures[0];
    const last = procedures.at(-1);
    if (first === undefined || last === undefined) {
      throw new Error("Parser invariant violated: module has no procedures.");
    }
    return {
      kind: "Module",
      declarations,
      procedures,
      span: mergeSpans(first.span, last.span),
    };
  }

  #parseDeclaration(): VariableDeclaration {
    const name = this.#consume("identifier");
    if (!this.#match("leftBracket")) {
      return {
        kind: "VariableDeclaration",
        variableKind: "scalar",
        name: normalizeName(name.lexeme),
        length: 1,
        nameSpan: name.span,
        span: name.span,
      };
    }

    const lengthToken = this.#consume("integer");
    const length = Number(lengthToken.lexeme);
    if (!Number.isSafeInteger(length) || length <= 0 || length > 0xffff_ffff) {
      throw new ParseError("Array length must be a positive integer", lengthToken.span);
    }
    const rightBracket = this.#consume("rightBracket");
    return {
      kind: "VariableDeclaration",
      variableKind: "array",
      name: normalizeName(name.lexeme),
      length,
      nameSpan: name.span,
      span: mergeSpans(name.span, rightBracket.span),
    };
  }

  #parseProcedure(): ProcedureDeclaration {
    const start = this.#consume("procedure");
    const name = this.#consume("identifier");
    let headerEnd = name.span;
    if (this.#match("leftParen")) headerEnd = this.#consume("rightParen").span;

    const body = this.#parseStatementsUntil(new Set(["procedure", "eof"]));
    const endSpan = body.at(-1)?.span ?? headerEnd;
    return {
      kind: "ProcedureDeclaration",
      name: normalizeName(name.lexeme),
      body,
      nameSpan: name.span,
      span: mergeSpans(start.span, endSpan),
    };
  }

  #parseStatementsUntil(terminators: ReadonlySet<TokenKind>): Statement[] {
    const statements: Statement[] = [];
    while (!terminators.has(this.#peek().kind)) statements.push(this.#parseStatement());
    return statements;
  }

  #parseStatement(): Statement {
    switch (this.#peek().kind) {
      case "call":
      case "uncall":
        return this.#parseCall();
      case "identifier":
        return this.#parseUpdateOrSwap();
      case "skip": {
        const token = this.#advance();
        return { kind: "SkipStatement", span: token.span };
      }
      case "if":
        return this.#parseIf();
      case "from":
        return this.#parseLoop();
      default: {
        const token = this.#peek();
        throw new ParseError(
          `Expected a statement, found ${this.#describe(token)}`,
          token.span,
        );
      }
    }
  }

  #parseCall(): CallStatement {
    const token = this.#advance();
    if (token.kind !== "call" && token.kind !== "uncall") {
      throw new Error("Parser invariant violated: call expected.");
    }
    const name = this.#consume("identifier");
    let end = name.span;
    if (this.#match("leftParen")) end = this.#consume("rightParen").span;
    return {
      kind: "CallStatement",
      callKind: token.kind,
      name: normalizeName(name.lexeme),
      nameSpan: name.span,
      span: mergeSpans(token.span, end),
    };
  }

  #parseUpdateOrSwap(): Statement {
    const left = this.#parseLocation();
    const operator = this.#advance();

    if (operator.kind === "swap") {
      const right = this.#parseLocation();
      return {
        kind: "SwapStatement",
        left,
        right,
        span: mergeSpans(left.span, right.span),
      };
    }

    const updateOperators: Partial<
      Record<TokenKind, "+=" | "-=" | "^=">
    > = {
      plusUpdate: "+=",
      minusUpdate: "-=",
      xorUpdate: "^=",
    };
    const updateOperator = updateOperators[operator.kind];
    if (updateOperator === undefined) {
      throw new ParseError(
        `Expected "call" or "uncall", an update, or swap; found ${this.#describe(operator)}`,
        operator.span,
      );
    }
    const expression = this.#parseExpression();
    return {
      kind: "UpdateStatement",
      operator: updateOperator,
      target: left,
      expression,
      span: mergeSpans(left.span, expression.span),
    };
  }

  #parseIf(): IfStatement {
    const start = this.#consume("if");
    const entryCondition = this.#parseExpression();
    const thenBranch = this.#match("then")
      ? this.#parseStatementsUntil(new Set(["else", "fi"]))
      : [];
    const elseBranch = this.#match("else")
      ? this.#parseStatementsUntil(new Set(["fi"]))
      : [];
    this.#consume("fi");
    const exitCondition = this.#parseExpression();
    return {
      kind: "IfStatement",
      entryCondition,
      thenBranch,
      elseBranch,
      exitCondition,
      span: mergeSpans(start.span, exitCondition.span),
    };
  }

  #parseLoop(): LoopStatement {
    const start = this.#consume("from");
    const entryAssertion = this.#parseExpression();
    const firstBody = this.#match("do")
      ? this.#parseStatementsUntil(new Set(["loop", "until"]))
      : [];
    const nextBody = this.#match("loop")
      ? this.#parseStatementsUntil(new Set(["until"]))
      : [];
    this.#consume("until");
    const exitTest = this.#parseExpression();
    return {
      kind: "LoopStatement",
      entryAssertion,
      firstBody,
      nextBody,
      exitTest,
      span: mergeSpans(start.span, exitTest.span),
    };
  }

  #parseLocation(): Location {
    const name = this.#consume("identifier");
    const normalizedName = normalizeName(name.lexeme);
    if (!this.#match("leftBracket")) {
      return {
        kind: "VariableLocation",
        name: normalizedName,
        nameSpan: name.span,
        span: name.span,
      };
    }
    const index = this.#parseExpression();
    const rightBracket = this.#consume("rightBracket");
    return {
      kind: "ArrayLocation",
      name: normalizedName,
      index,
      nameSpan: name.span,
      span: mergeSpans(name.span, rightBracket.span),
    } satisfies ArrayLocation;
  }

  #parseExpression(): Expression {
    let expression = this.#parseUnary();
    while (true) {
      const operator = binaryOperators[this.#peek().kind];
      if (operator === undefined) break;
      this.#advance();
      const right = this.#parseUnary();
      expression = {
        kind: "BinaryExpression",
        operator,
        left: expression,
        right,
        span: mergeSpans(expression.span, right.span),
      };
    }
    return expression;
  }

  #parseUnary(): Expression {
    const token = this.#peek();
    if (token.kind === "minus" || token.kind === "tilde") {
      this.#advance();
      const operand = this.#parseUnary();
      return {
        kind: "UnaryExpression",
        operator: token.lexeme as UnaryOperator,
        operand,
        span: mergeSpans(token.span, operand.span),
      };
    }
    return this.#parsePrimary();
  }

  #parsePrimary(): Expression {
    const token = this.#advance();
    if (token.kind === "integer") {
      return {
        kind: "IntegerLiteral",
        value: Number(BigInt.asIntN(32, BigInt(token.lexeme))),
        span: token.span,
      };
    }
    if (token.kind === "identifier") {
      const name = normalizeName(token.lexeme);
      if (!this.#match("leftBracket")) {
        return { kind: "VariableExpression", name, span: token.span };
      }
      const index = this.#parseExpression();
      const rightBracket = this.#consume("rightBracket");
      return {
        kind: "ArrayAccessExpression",
        name,
        index,
        nameSpan: token.span,
        span: mergeSpans(token.span, rightBracket.span),
      };
    }
    if (token.kind === "leftParen") {
      const expression = this.#parseExpression();
      const rightParen = this.#consume("rightParen");
      return { ...expression, span: mergeSpans(token.span, rightParen.span) };
    }
    throw new ParseError(`Expected an expression, found ${this.#describe(token)}`, token.span);
  }

  #consume(kind: TokenKind): Token {
    const token = this.#peek();
    if (token.kind !== kind) {
      throw new ParseError(
        `Expected ${tokenLabel[kind] ?? JSON.stringify(kind)}, found ${this.#describe(token)}`,
        token.span,
      );
    }
    this.#index += 1;
    return token;
  }

  #match(kind: TokenKind): boolean {
    if (!this.#check(kind)) return false;
    this.#index += 1;
    return true;
  }

  #check(kind: TokenKind): boolean {
    return this.#peek().kind === kind;
  }

  #advance(): Token {
    const token = this.#peek();
    if (token.kind !== "eof") this.#index += 1;
    return token;
  }

  #peek(): Token {
    const token = this.tokens[this.#index];
    if (token === undefined) {
      throw new Error("Parser invariant violated: missing EOF token.");
    }
    return token;
  }

  #describe(token: Token): string {
    return token.kind === "eof" ? (tokenLabel.eof ?? "end of input") : JSON.stringify(token.lexeme);
  }
}

export const parse = (source: string): JanusModule =>
  new Parser(tokenize(source)).parseModule();
