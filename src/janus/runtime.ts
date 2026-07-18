import type {
  BinaryExpression,
  Direction,
  Expression,
  Location,
} from "./ast";
import { checkStatic } from "./checker";
import { parse } from "./parser";
import {
  linkNames,
  type ResolvedModule,
  type ResolvedProcedure,
  type ResolvedStatement,
} from "./resolver";
import type { SourceSpan } from "./span";

export type StateValue = number | readonly number[];
export type StateInput = Readonly<Record<string, StateValue>>;
export type StateSnapshot = Readonly<Record<string, number | readonly number[]>>;

export type RuntimeOptions = {
  totalStepBudget?: number;
  callDepthBudget?: number;
  loopIterationBudget?: number;
};

type RequiredRuntimeOptions = Required<RuntimeOptions>;

const defaultRuntimeOptions: RequiredRuntimeOptions = {
  totalStepBudget: 100_000,
  callDepthBudget: 256,
  loopIterationBudget: 10_000,
};

export class JanusRuntimeError extends Error {
  constructor(
    message: string,
    readonly span: SourceSpan,
  ) {
    super(`${message} at ${span.start.line}:${span.start.column}`);
    this.name = "JanusRuntimeError";
  }
}

export class AssertionFailure extends JanusRuntimeError {
  constructor(message: string, span: SourceSpan) {
    super(message, span);
    this.name = "AssertionFailure";
  }
}

export class ExecutionLimitExceeded extends JanusRuntimeError {
  constructor(
    readonly limit: "totalSteps" | "callDepth" | "loopIterations",
    span: SourceSpan,
  ) {
    super(`Execution limit exceeded: ${limit}`, span);
    this.name = "ExecutionLimitExceeded";
  }
}

export class StateValidationError extends JanusRuntimeError {
  constructor(message: string, span: SourceSpan) {
    super(message, span);
    this.name = "StateValidationError";
  }
}

type StoreValue = number | Int32Array;

class Store {
  readonly #values = new Map<string, StoreValue>();

  constructor(
    private readonly module: ResolvedModule,
    initial: StateInput,
  ) {
    const declarations = new Map(module.declarations.map((declaration) => [declaration.name, declaration]));
    const supplied = new Map<string, StateValue>();

    for (const [rawName, value] of Object.entries(initial)) {
      const name = rawName.toLowerCase();
      if (supplied.has(name)) {
        throw new StateValidationError(
          `Initial state supplies ${JSON.stringify(name)} more than once`,
          module.span,
        );
      }
      if (!declarations.has(name)) {
        throw new StateValidationError(
          `Initial state contains undeclared variable ${JSON.stringify(rawName)}`,
          module.span,
        );
      }
      supplied.set(name, value);
    }

    for (const declaration of module.declarations) {
      const value = supplied.get(declaration.name);
      if (declaration.variableKind === "scalar") {
        if (value !== undefined && typeof value !== "number") {
          throw new StateValidationError(
            `Scalar ${JSON.stringify(declaration.name)} requires an integer`,
            declaration.nameSpan,
          );
        }
        this.#values.set(
          declaration.name,
          value === undefined ? 0 : validateInteger(value, declaration.nameSpan),
        );
        continue;
      }

      if (value !== undefined && !Array.isArray(value)) {
        throw new StateValidationError(
          `Array ${JSON.stringify(declaration.name)} requires an integer array`,
          declaration.nameSpan,
        );
      }
      if (value !== undefined && value.length !== declaration.length) {
        throw new StateValidationError(
          `Array ${JSON.stringify(declaration.name)} requires length ${declaration.length}, received ${value.length}`,
          declaration.nameSpan,
        );
      }
      try {
        const array = new Int32Array(declaration.length);
        if (value !== undefined) {
          value.forEach((entry, index) => {
            array[index] = validateInteger(entry, declaration.nameSpan);
          });
        }
        this.#values.set(declaration.name, array);
      } catch (error) {
        if (error instanceof JanusRuntimeError) throw error;
        throw new StateValidationError(
          `Cannot allocate array ${JSON.stringify(declaration.name)} of length ${declaration.length}`,
          declaration.nameSpan,
        );
      }
    }
  }

  scalar(name: string, span: SourceSpan): number {
    const value = this.#values.get(name);
    if (typeof value !== "number") {
      throw new JanusRuntimeError(`Expected scalar ${JSON.stringify(name)}`, span);
    }
    return value;
  }

  setScalar(name: string, value: number, span: SourceSpan): void {
    if (typeof this.#values.get(name) !== "number") {
      throw new JanusRuntimeError(`Expected scalar ${JSON.stringify(name)}`, span);
    }
    this.#values.set(name, toInt32(value));
  }

  arrayElement(name: string, index: number, span: SourceSpan): number {
    const array = this.#array(name, span);
    this.#checkIndex(name, array, index, span);
    const value = array[index];
    if (value === undefined) throw new JanusRuntimeError("Array access invariant failed", span);
    return value;
  }

  setArrayElement(name: string, index: number, value: number, span: SourceSpan): void {
    const array = this.#array(name, span);
    this.#checkIndex(name, array, index, span);
    array[index] = toInt32(value);
  }

  snapshot(): StateSnapshot {
    return Object.fromEntries(
      this.module.declarations.map((declaration) => {
        const value = this.#values.get(declaration.name);
        if (value === undefined) throw new Error("Store invariant violated: missing value.");
        return [declaration.name, typeof value === "number" ? value : Array.from(value)];
      }),
    );
  }

  #array(name: string, span: SourceSpan): Int32Array {
    const value = this.#values.get(name);
    if (!(value instanceof Int32Array)) {
      throw new JanusRuntimeError(`Expected array ${JSON.stringify(name)}`, span);
    }
    return value;
  }

  #checkIndex(name: string, array: Int32Array, index: number, span: SourceSpan): void {
    if (index < 0 || index >= array.length) {
      throw new JanusRuntimeError(
        `Array index ${index} is out of bounds for ${JSON.stringify(name)}[${array.length}]`,
        span,
      );
    }
  }
}

const validateInteger = (value: number, span: SourceSpan): number => {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new StateValidationError(`State value ${String(value)} is not an integer`, span);
  }
  return toInt32(value);
};

const toInt32 = (value: number): number => value | 0;
const truth = (value: number): boolean => value !== 0;
const reverseDirection = (direction: Direction): Direction =>
  direction === "forward" ? "backward" : "forward";

type ResolvedLocation = {
  get(): number;
  set(value: number): void;
};

class Evaluator {
  readonly #procedures: ReadonlyMap<string, ResolvedProcedure>;
  readonly #options: RequiredRuntimeOptions;
  #steps = 0;
  #callDepth = 0;
  #loopIterations = 0;

  constructor(
    private readonly module: ResolvedModule,
    private readonly store: Store,
    options: RuntimeOptions,
  ) {
    this.#procedures = new Map(
      module.procedures.map((procedure) => [procedure.name, procedure]),
    );
    this.#options = { ...defaultRuntimeOptions, ...options };
    for (const [name, value] of Object.entries(this.#options)) {
      if (!Number.isSafeInteger(value) || value <= 0) {
        throw new JanusRuntimeError(`${name} must be a positive integer`, module.span);
      }
    }
  }

  execute(name: string, direction: Direction): void {
    this.#executeProcedure(name.toLowerCase(), direction, this.module.span);
  }

  #executeProcedure(name: string, direction: Direction, span: SourceSpan): void {
    const procedure = this.#procedures.get(name);
    if (procedure === undefined) {
      throw new JanusRuntimeError(`Unknown entry procedure ${JSON.stringify(name)}`, span);
    }
    this.#callDepth += 1;
    if (this.#callDepth > this.#options.callDepthBudget) {
      this.#callDepth -= 1;
      throw new ExecutionLimitExceeded("callDepth", span);
    }
    try {
      this.#executeSequence(procedure.body, direction);
    } finally {
      this.#callDepth -= 1;
    }
  }

  #executeSequence(statements: readonly ResolvedStatement[], direction: Direction): void {
    if (direction === "forward") {
      for (const statement of statements) this.#executeStatement(statement, direction);
    } else {
      for (let index = statements.length - 1; index >= 0; index -= 1) {
        const statement = statements[index];
        if (statement !== undefined) this.#executeStatement(statement, direction);
      }
    }
  }

  #executeStatement(statement: ResolvedStatement, direction: Direction): void {
    this.#steps += 1;
    if (this.#steps > this.#options.totalStepBudget) {
      throw new ExecutionLimitExceeded("totalSteps", statement.span);
    }

    switch (statement.kind) {
      case "SkipStatement":
        return;
      case "CallStatement": {
        if (statement.target === "primitive") {
          throw new JanusRuntimeError(
            "Host primitives cannot execute in the Pure Janus evaluator",
            statement.span,
          );
        }
        const callDirection =
          statement.callKind === "call" ? direction : reverseDirection(direction);
        this.#executeProcedure(statement.name, callDirection, statement.span);
        return;
      }
      case "UpdateStatement": {
        const target = this.#resolveLocation(statement.target);
        const right = this.#evaluate(statement.expression);
        const left = target.get();
        const forwardOperator =
          direction === "forward"
            ? statement.operator
            : statement.operator === "+="
              ? "-="
              : statement.operator === "-="
                ? "+="
                : "^=";
        const value =
          forwardOperator === "+="
            ? left + right
            : forwardOperator === "-="
              ? left - right
              : left ^ right;
        target.set(value);
        return;
      }
      case "SwapStatement": {
        const left = this.#resolveLocation(statement.left);
        const right = this.#resolveLocation(statement.right);
        const leftValue = left.get();
        const rightValue = right.get();
        left.set(rightValue);
        right.set(leftValue);
        return;
      }
      case "IfStatement": {
        const selectingCondition =
          direction === "forward" ? statement.entryCondition : statement.exitCondition;
        const selected = truth(this.#evaluate(selectingCondition));
        this.#executeSequence(selected ? statement.thenBranch : statement.elseBranch, direction);
        const assertedCondition =
          direction === "forward" ? statement.exitCondition : statement.entryCondition;
        if (truth(this.#evaluate(assertedCondition)) !== selected) {
          throw new AssertionFailure(
            `Conditional assertion did not preserve the selected ${selected ? "then" : "else"} branch`,
            assertedCondition.span,
          );
        }
        return;
      }
      case "LoopStatement": {
        const entry =
          direction === "forward" ? statement.entryAssertion : statement.exitTest;
        const exit =
          direction === "forward" ? statement.exitTest : statement.entryAssertion;
        if (!truth(this.#evaluate(entry))) {
          throw new AssertionFailure("Loop entry assertion is false", entry.span);
        }
        while (true) {
          this.#loopIterations += 1;
          if (this.#loopIterations > this.#options.loopIterationBudget) {
            throw new ExecutionLimitExceeded("loopIterations", statement.span);
          }
          this.#executeSequence(statement.firstBody, direction);
          if (truth(this.#evaluate(exit))) return;
          this.#executeSequence(statement.nextBody, direction);
          if (truth(this.#evaluate(entry))) {
            throw new AssertionFailure(
              "Loop entry assertion must be false between iterations",
              entry.span,
            );
          }
        }
      }
    }
  }

  #resolveLocation(location: Location): ResolvedLocation {
    if (location.kind === "VariableLocation") {
      return {
        get: () => this.store.scalar(location.name, location.span),
        set: (value) => this.store.setScalar(location.name, value, location.span),
      };
    }
    const index = this.#evaluate(location.index);
    return {
      get: () => this.store.arrayElement(location.name, index, location.span),
      set: (value) => this.store.setArrayElement(location.name, index, value, location.span),
    };
  }

  #evaluate(expression: Expression): number {
    switch (expression.kind) {
      case "IntegerLiteral":
        return expression.value;
      case "VariableExpression":
        return this.store.scalar(expression.name, expression.span);
      case "ArrayAccessExpression":
        return this.store.arrayElement(
          expression.name,
          this.#evaluate(expression.index),
          expression.span,
        );
      case "UnaryExpression": {
        const operand = this.#evaluate(expression.operand);
        return expression.operator === "-" ? toInt32(-operand) : operand === 0 ? -1 : 0;
      }
      case "BinaryExpression":
        return this.#evaluateBinary(expression);
    }
  }

  #evaluateBinary(expression: BinaryExpression): number {
    const left = this.#evaluate(expression.left);
    const right = this.#evaluate(expression.right);
    switch (expression.operator) {
      case "+":
        return toInt32(left + right);
      case "-":
        return toInt32(left - right);
      case "*":
        return Math.imul(left, right);
      case "/":
        if (right === 0) throw new JanusRuntimeError("Division by zero", expression.span);
        return toInt32(Math.trunc(left / right));
      case "\\":
        if (right === 0) throw new JanusRuntimeError("Remainder by zero", expression.span);
        return toInt32(left - Math.trunc(left / right) * right);
      case "!":
        return left ^ right;
      case "&":
        return truth(left) && truth(right) ? -1 : 0;
      case "|":
        return truth(left) || truth(right) ? -1 : 0;
      case "=":
        return left === right ? -1 : 0;
      case "#":
        return left !== right ? -1 : 0;
      case "<":
        return left < right ? -1 : 0;
      case ">":
        return left > right ? -1 : 0;
      case "<=":
        return left <= right ? -1 : 0;
      case ">=":
        return left >= right ? -1 : 0;
    }
  }
}

export class ExecutableJanusModule {
  constructor(readonly ast: ResolvedModule) {}

  call(
    procedureName: string,
    initialState: StateInput = {},
    options: RuntimeOptions = {},
  ): StateSnapshot {
    return this.#run(procedureName, "forward", initialState, options);
  }

  uncall(
    procedureName: string,
    initialState: StateInput = {},
    options: RuntimeOptions = {},
  ): StateSnapshot {
    return this.#run(procedureName, "backward", initialState, options);
  }

  #run(
    procedureName: string,
    direction: Direction,
    initialState: StateInput,
    options: RuntimeOptions,
  ): StateSnapshot {
    const store = new Store(this.ast, initialState);
    new Evaluator(this.ast, store, options).execute(procedureName, direction);
    return store.snapshot();
  }
}

export const compileModule = (module: ReturnType<typeof parse>): ExecutableJanusModule => {
  checkStatic(module);
  return new ExecutableJanusModule(linkNames(module));
};

export const compileJanus = (source: string): ExecutableJanusModule =>
  compileModule(parse(source));
