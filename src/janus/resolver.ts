import type {
  CallStatement,
  IfStatement,
  JanusModule,
  LoopStatement,
  ProcedureDeclaration,
  SkipStatement,
  Statement,
  SwapStatement,
  UpdateStatement,
} from "./ast";
import type { SourceSpan } from "./span";

export type NameDiagnostic = {
  message: string;
  span: SourceSpan;
};

export type PrimitiveManifest = {
  name: string;
  hasForward: boolean;
  hasBackward: boolean;
};

export type ResolvedCallStatement = CallStatement & {
  target: "procedure" | "primitive";
};

export type ResolvedIfStatement = Omit<IfStatement, "thenBranch" | "elseBranch"> & {
  thenBranch: readonly ResolvedStatement[];
  elseBranch: readonly ResolvedStatement[];
  target: undefined;
};

export type ResolvedLoopStatement = Omit<LoopStatement, "firstBody" | "nextBody"> & {
  firstBody: readonly ResolvedStatement[];
  nextBody: readonly ResolvedStatement[];
  target: undefined;
};

export type ResolvedStatement =
  | ResolvedCallStatement
  | UpdateStatement
  | (SkipStatement & { target: undefined })
  | (SwapStatement & { target: undefined })
  | ResolvedIfStatement
  | ResolvedLoopStatement;

export type ResolvedProcedure = Omit<ProcedureDeclaration, "body"> & {
  body: readonly ResolvedStatement[];
};

export type ResolvedModule = Omit<JanusModule, "procedures"> & {
  procedures: readonly ResolvedProcedure[];
};

export class NameResolutionError extends Error {
  constructor(readonly diagnostics: readonly NameDiagnostic[]) {
    super(diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
    this.name = "NameResolutionError";
  }
}

const normalized = (name: string): string => name.toLowerCase();

const resolve = (
  module: JanusModule,
  manifests: readonly PrimitiveManifest[],
): ResolvedModule => {
  const diagnostics: NameDiagnostic[] = [];
  const procedures = new Map<string, ProcedureDeclaration>();
  const primitives = new Map<string, PrimitiveManifest>();

  const report = (message: string, span: SourceSpan): void => {
    diagnostics.push({
      message: `${message} at ${span.start.line}:${span.start.column}`,
      span,
    });
  };

  for (const manifest of manifests) {
    const name = normalized(manifest.name);
    if (primitives.has(name)) {
      report(`Duplicate primitive ${JSON.stringify(name)}`, module.span);
    } else {
      primitives.set(name, { ...manifest, name });
    }
    if (!manifest.hasForward || !manifest.hasBackward) {
      report(`Primitive ${JSON.stringify(name)} must provide both directions`, module.span);
    }
  }

  for (const procedure of module.procedures) {
    if (procedures.has(procedure.name)) {
      report(`Duplicate procedure ${JSON.stringify(procedure.name)}`, procedure.nameSpan);
    } else {
      procedures.set(procedure.name, procedure);
    }
    if (primitives.has(procedure.name)) {
      report(
        `Procedure ${JSON.stringify(procedure.name)} conflicts with a host primitive`,
        procedure.nameSpan,
      );
    }
  }

  const resolveStatements = (statements: readonly Statement[]): ResolvedStatement[] =>
    statements.flatMap((statement): ResolvedStatement[] => {
      if (statement.kind === "CallStatement") {
        const target = procedures.has(statement.name)
          ? "procedure"
          : primitives.has(statement.name)
            ? "primitive"
            : undefined;
        if (target === undefined) {
          report(
            `Undefined procedure or primitive ${JSON.stringify(statement.name)}`,
            statement.nameSpan,
          );
          return [];
        }
        return [{ ...statement, target }];
      }
      if (statement.kind === "IfStatement") {
        return [
          {
            ...statement,
            thenBranch: resolveStatements(statement.thenBranch),
            elseBranch: resolveStatements(statement.elseBranch),
            target: undefined,
          },
        ];
      }
      if (statement.kind === "LoopStatement") {
        return [
          {
            ...statement,
            firstBody: resolveStatements(statement.firstBody),
            nextBody: resolveStatements(statement.nextBody),
            target: undefined,
          },
        ];
      }
      if (statement.kind === "UpdateStatement") return [statement];
      return [{ ...statement, target: undefined }];
    });

  const resolvedProcedures: ResolvedProcedure[] = module.procedures.map((procedure) => ({
    ...procedure,
    body: resolveStatements(procedure.body),
  }));

  if (diagnostics.length > 0) throw new NameResolutionError(diagnostics);
  return { ...module, procedures: resolvedProcedures };
};

export const linkNames = (
  module: JanusModule,
  primitiveManifests: readonly PrimitiveManifest[] = [],
): ResolvedModule => resolve(module, primitiveManifests);

export const resolveNames = (
  module: JanusModule,
  primitiveNames: ReadonlySet<string>,
): ResolvedModule =>
  resolve(
    module,
    [...primitiveNames].map((name) => ({ name, hasForward: true, hasBackward: true })),
  );
