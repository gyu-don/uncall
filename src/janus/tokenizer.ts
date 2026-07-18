import type { SourcePosition, SourceSpan } from "./span";

export type TokenKind =
  | "procedure"
  | "call"
  | "uncall"
  | "skip"
  | "if"
  | "then"
  | "else"
  | "fi"
  | "from"
  | "do"
  | "loop"
  | "until"
  | "identifier"
  | "integer"
  | "leftParen"
  | "rightParen"
  | "leftBracket"
  | "rightBracket"
  | "plus"
  | "minus"
  | "star"
  | "slash"
  | "backslash"
  | "bang"
  | "ampersand"
  | "pipe"
  | "equal"
  | "hash"
  | "less"
  | "greater"
  | "lessEqual"
  | "greaterEqual"
  | "tilde"
  | "plusUpdate"
  | "minusUpdate"
  | "xorUpdate"
  | "swap"
  | "eof";

export type Token = {
  kind: TokenKind;
  lexeme: string;
  span: SourceSpan;
};

const keywordKinds = new Map<string, TokenKind>([
  ["procedure", "procedure"],
  ["call", "call"],
  ["uncall", "uncall"],
  ["skip", "skip"],
  ["if", "if"],
  ["then", "then"],
  ["else", "else"],
  ["fi", "fi"],
  ["from", "from"],
  ["do", "do"],
  ["loop", "loop"],
  ["until", "until"],
]);

const isIdentifierStart = (character: string): boolean =>
  /[A-Za-z_]/u.test(character);
const isIdentifierPart = (character: string): boolean =>
  /[A-Za-z0-9_]/u.test(character);
const isDigit = (character: string): boolean => /[0-9]/u.test(character);

const clonePosition = (position: SourcePosition): SourcePosition => ({ ...position });

export class TokenizeError extends SyntaxError {
  constructor(
    message: string,
    readonly span: SourceSpan,
  ) {
    super(`${message} at ${span.start.line}:${span.start.column}`);
    this.name = "TokenizeError";
  }
}

export const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  const position: SourcePosition = { offset: 0, line: 1, column: 1 };

  const current = (): string => source[position.offset] ?? "";
  const peek = (distance = 1): string => source[position.offset + distance] ?? "";
  const advance = (): string => {
    const character = current();
    position.offset += 1;
    position.column += 1;
    return character;
  };
  const addToken = (kind: TokenKind, lexeme: string, start: SourcePosition): void => {
    tokens.push({ kind, lexeme, span: { start, end: clonePosition(position) } });
  };
  const skipLine = (): void => {
    while (position.offset < source.length && current() !== "\r" && current() !== "\n") {
      advance();
    }
  };

  const skipTrivia = (): void => {
    while (position.offset < source.length) {
      if (current() === "\r") {
        position.offset += 1;
        if (current() === "\n") position.offset += 1;
        position.line += 1;
        position.column = 1;
      } else if (current() === "\n") {
        position.offset += 1;
        position.line += 1;
        position.column = 1;
      } else if (current() === " " || current() === "\t") {
        advance();
      } else if (current() === ";" || (current() === "/" && peek() === "/")) {
        skipLine();
      } else {
        break;
      }
    }
  };

  const fixedTokens: ReadonlyArray<readonly [string, TokenKind]> = [
    ["<=>", "swap"],
    ["+=", "plusUpdate"],
    ["-=", "minusUpdate"],
    ["^=", "xorUpdate"],
    ["!=", "xorUpdate"],
    ["<=", "lessEqual"],
    [">=", "greaterEqual"],
    ["(", "leftParen"],
    [")", "rightParen"],
    ["[", "leftBracket"],
    ["]", "rightBracket"],
    ["+", "plus"],
    ["-", "minus"],
    ["*", "star"],
    ["/", "slash"],
    ["\\", "backslash"],
    ["!", "bang"],
    ["&", "ampersand"],
    ["|", "pipe"],
    ["=", "equal"],
    ["#", "hash"],
    ["<", "less"],
    [">", "greater"],
    ["~", "tilde"],
    [":", "swap"],
  ];

  while (position.offset < source.length) {
    skipTrivia();
    if (position.offset >= source.length) break;

    const start = clonePosition(position);
    const character = current();

    if (isIdentifierStart(character)) {
      let lexeme = advance();
      while (isIdentifierPart(current())) lexeme += advance();
      addToken(keywordKinds.get(lexeme.toLowerCase()) ?? "identifier", lexeme, start);
      continue;
    }

    if (isDigit(character)) {
      let lexeme = advance();
      while (isDigit(current())) lexeme += advance();
      addToken("integer", lexeme, start);
      continue;
    }

    const match = fixedTokens.find(([text]) => source.startsWith(text, position.offset));
    if (match !== undefined) {
      const [text, kind] = match;
      for (let index = 0; index < text.length; index += 1) advance();
      addToken(kind, text, start);
      continue;
    }

    advance();
    throw new TokenizeError(`Unexpected character ${JSON.stringify(character)}`, {
      start,
      end: clonePosition(position),
    });
  }

  const eof = clonePosition(position);
  tokens.push({ kind: "eof", lexeme: "", span: { start: eof, end: eof } });
  return tokens;
};
