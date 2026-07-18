import type {
  ResolvedModule,
  ResolvedProcedure,
  ResolvedStatement,
} from "../janus/resolver";
import type { SourceSpan } from "../janus/span";
import { HostCompileError, type HostDiagnostic } from "./errors";

const statementDescription = (statement: ResolvedStatement): string => {
  switch (statement.kind) {
    case "UpdateStatement":
      return "data update";
    case "SwapStatement":
      return "swap";
    case "SkipStatement":
      return "skip";
    case "IfStatement":
      return "if";
    case "LoopStatement":
      return "loop";
    case "CallStatement":
      return "call";
  }
};

export const checkHostModule = (module: ResolvedModule): ResolvedModule => {
  const diagnostics: HostDiagnostic[] = [];
  const report = (message: string, span: SourceSpan): void => {
    diagnostics.push({
      message: `${message} at ${span.start.line}:${span.start.column}`,
      span,
    });
  };

  for (const declaration of module.declarations) {
    report(
      `Host modules are calls-only; data declaration ${JSON.stringify(declaration.name)} is not allowed`,
      declaration.span,
    );
  }

  for (const procedure of module.procedures) {
    for (const statement of procedure.body) {
      if (statement.kind !== "CallStatement") {
        report(
          `Host modules are calls-only; ${statementDescription(statement)} is not allowed`,
          statement.span,
        );
      }
    }
  }

  const procedures = new Map<string, ResolvedProcedure>(
    module.procedures.map((procedure) => [procedure.name, procedure]),
  );
  const state = new Map<string, "visiting" | "visited">();

  const visit = (procedure: ResolvedProcedure): void => {
    state.set(procedure.name, "visiting");
    for (const statement of procedure.body) {
      if (statement.kind !== "CallStatement" || statement.target !== "procedure") continue;
      const target = procedures.get(statement.name);
      if (target === undefined) continue;
      const targetState = state.get(target.name);
      if (targetState === "visiting") {
        report(
          `Recursive host procedure call to ${JSON.stringify(target.name)} is not allowed`,
          statement.span,
        );
      } else if (targetState === undefined) {
        visit(target);
      }
    }
    state.set(procedure.name, "visited");
  };

  for (const procedure of module.procedures) {
    if (state.get(procedure.name) === undefined) visit(procedure);
  }

  if (diagnostics.length > 0) throw new HostCompileError(diagnostics);
  return module;
};
