import type { SourceSpan } from "../janus/span";

export type HostDiagnostic = {
  message: string;
  span: SourceSpan;
};

export class HostCompileError extends Error {
  readonly span: SourceSpan | undefined;

  constructor(
    readonly diagnostics: readonly HostDiagnostic[],
    options: { cause?: unknown } = {},
  ) {
    super(
      diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "HostCompileError";
    this.span = diagnostics[0]?.span;
  }
}

export type HostRuntimeErrorCode =
  | "unknown-procedure"
  | "unsupported-statement"
  | "recursive-call"
  | "primitive-not-registered"
  | "primitive-failed"
  | "receipt-missing"
  | "receipt-mismatch"
  | "foreign-receipt"
  | "concurrent-execution"
  | "cleanup-failed";

export class HostRuntimeError extends Error {
  constructor(
    message: string,
    readonly span: SourceSpan,
    readonly code: HostRuntimeErrorCode,
    options: { cause?: unknown } = {},
  ) {
    super(
      `${message} at ${span.start.line}:${span.start.column}`,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "HostRuntimeError";
  }
}

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
