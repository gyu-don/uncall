import { checkStatic, StaticCheckError } from "../janus/checker";
import { parse, ParseError } from "../janus/parser";
import {
  linkNames,
  NameResolutionError,
  type PrimitiveManifest,
  type ResolvedModule,
} from "../janus/resolver";
import { TokenizeError } from "../janus/tokenizer";
import { checkHostModule } from "./checker";
import { HostCompileError, type HostDiagnostic } from "./errors";

export type PrimitiveManifestSource = {
  readonly manifests: readonly PrimitiveManifest[];
};

const diagnosticsFrom = (error: unknown): readonly HostDiagnostic[] | undefined => {
  if (error instanceof ParseError || error instanceof TokenizeError) {
    return [{ message: error.message, span: error.span }];
  }
  if (error instanceof StaticCheckError || error instanceof NameResolutionError) {
    return error.diagnostics;
  }
  return undefined;
};

export const compileHostModule = (
  source: string,
  primitives: PrimitiveManifestSource,
): ResolvedModule => {
  try {
    const parsed = parse(source);
    const checked = checkStatic(parsed);
    const linked = linkNames(checked, primitives.manifests);
    return checkHostModule(linked);
  } catch (error) {
    if (error instanceof HostCompileError) throw error;
    const diagnostics = diagnosticsFrom(error);
    if (diagnostics === undefined) throw error;
    throw new HostCompileError(diagnostics, { cause: error });
  }
};
