import type {
  Expression,
  JanusModule,
  Location,
  Statement,
  VariableDeclaration,
} from "./ast";
import type { SourceSpan } from "./span";

export type StaticDiagnostic = {
  message: string;
  span: SourceSpan;
};

export class StaticCheckError extends Error {
  constructor(readonly diagnostics: readonly StaticDiagnostic[]) {
    super(diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
    this.name = "StaticCheckError";
  }
}

const referencedNames = (expression: Expression, names = new Set<string>()): Set<string> => {
  switch (expression.kind) {
    case "IntegerLiteral":
      break;
    case "VariableExpression":
      names.add(expression.name);
      break;
    case "ArrayAccessExpression":
      names.add(expression.name);
      referencedNames(expression.index, names);
      break;
    case "UnaryExpression":
      referencedNames(expression.operand, names);
      break;
    case "BinaryExpression":
      referencedNames(expression.left, names);
      referencedNames(expression.right, names);
      break;
  }
  return names;
};

export const checkStatic = (module: JanusModule): JanusModule => {
  const diagnostics: StaticDiagnostic[] = [];
  const variables = new Map<string, VariableDeclaration>();

  const report = (message: string, span: SourceSpan): void => {
    diagnostics.push({
      message: `${message} at ${span.start.line}:${span.start.column}`,
      span,
    });
  };

  for (const declaration of module.declarations) {
    if (variables.has(declaration.name)) {
      report(`Duplicate variable ${JSON.stringify(declaration.name)}`, declaration.nameSpan);
    } else {
      variables.set(declaration.name, declaration);
    }
  }

  const checkExpression = (expression: Expression): void => {
    switch (expression.kind) {
      case "IntegerLiteral":
        return;
      case "VariableExpression": {
        const declaration = variables.get(expression.name);
        if (declaration === undefined) {
          report(`Undeclared variable ${JSON.stringify(expression.name)}`, expression.span);
        } else if (declaration.variableKind !== "scalar") {
          report(`Array ${JSON.stringify(expression.name)} requires an index`, expression.span);
        }
        return;
      }
      case "ArrayAccessExpression": {
        const declaration = variables.get(expression.name);
        if (declaration === undefined) {
          report(`Undeclared array ${JSON.stringify(expression.name)}`, expression.nameSpan);
        } else if (declaration.variableKind !== "array") {
          report(`Scalar ${JSON.stringify(expression.name)} cannot be indexed`, expression.nameSpan);
        }
        checkExpression(expression.index);
        return;
      }
      case "UnaryExpression":
        checkExpression(expression.operand);
        return;
      case "BinaryExpression":
        checkExpression(expression.left);
        checkExpression(expression.right);
        return;
    }
  };

  const checkLocation = (location: Location): void => {
    const declaration = variables.get(location.name);
    if (declaration === undefined) {
      report(`Undeclared variable ${JSON.stringify(location.name)}`, location.nameSpan);
    } else if (location.kind === "VariableLocation" && declaration.variableKind !== "scalar") {
      report(`Array ${JSON.stringify(location.name)} requires an index`, location.nameSpan);
    } else if (location.kind === "ArrayLocation" && declaration.variableKind !== "array") {
      report(`Scalar ${JSON.stringify(location.name)} cannot be indexed`, location.nameSpan);
    }
    if (location.kind === "ArrayLocation") checkExpression(location.index);
  };

  const checkStatements = (statements: readonly Statement[]): void => {
    for (const statement of statements) {
      switch (statement.kind) {
        case "CallStatement":
        case "SkipStatement":
          break;
        case "UpdateStatement": {
          checkLocation(statement.target);
          checkExpression(statement.expression);
          const rightNames = referencedNames(statement.expression);
          if (rightNames.has(statement.target.name)) {
            report(
              `Update of ${JSON.stringify(statement.target.name)} depends on its target`,
              statement.expression.span,
            );
          }
          if (
            statement.target.kind === "ArrayLocation" &&
            referencedNames(statement.target.index).has(statement.target.name)
          ) {
            report(
              `Array update index depends on updated array ${JSON.stringify(statement.target.name)}`,
              statement.target.index.span,
            );
          }
          break;
        }
        case "SwapStatement": {
          checkLocation(statement.left);
          checkLocation(statement.right);
          const updatedNames = new Set([statement.left.name, statement.right.name]);
          for (const location of [statement.left, statement.right]) {
            if (location.kind !== "ArrayLocation") continue;
            const unsafeName = [...referencedNames(location.index)].find((name) =>
              updatedNames.has(name),
            );
            if (unsafeName !== undefined) {
              report(
                `Swap index depends on updated variable ${JSON.stringify(unsafeName)}`,
                location.index.span,
              );
            }
          }
          break;
        }
        case "IfStatement":
          checkExpression(statement.entryCondition);
          checkStatements(statement.thenBranch);
          checkStatements(statement.elseBranch);
          checkExpression(statement.exitCondition);
          break;
        case "LoopStatement":
          checkExpression(statement.entryAssertion);
          checkStatements(statement.firstBody);
          checkStatements(statement.nextBody);
          checkExpression(statement.exitTest);
          break;
      }
    }
  };

  for (const procedure of module.procedures) checkStatements(procedure.body);

  if (diagnostics.length > 0) throw new StaticCheckError(diagnostics);
  return module;
};

export const getReferencedNames = (expression: Expression): ReadonlySet<string> =>
  referencedNames(expression);
