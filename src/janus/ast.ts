import type { SourceSpan } from "./span";

export type Direction = "forward" | "backward";
export type CallKind = "call" | "uncall";

export type BinaryOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "\\"
  | "!"
  | "&"
  | "|"
  | "="
  | "#"
  | "<"
  | ">"
  | "<="
  | ">=";

export type UnaryOperator = "-" | "~";

export type IntegerLiteral = {
  kind: "IntegerLiteral";
  value: number;
  span: SourceSpan;
};

export type VariableExpression = {
  kind: "VariableExpression";
  name: string;
  span: SourceSpan;
};

export type ArrayAccessExpression = {
  kind: "ArrayAccessExpression";
  name: string;
  index: Expression;
  span: SourceSpan;
  nameSpan: SourceSpan;
};

export type UnaryExpression = {
  kind: "UnaryExpression";
  operator: UnaryOperator;
  operand: Expression;
  span: SourceSpan;
};

export type BinaryExpression = {
  kind: "BinaryExpression";
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
  span: SourceSpan;
};

export type Expression =
  | IntegerLiteral
  | VariableExpression
  | ArrayAccessExpression
  | UnaryExpression
  | BinaryExpression;

export type VariableLocation = {
  kind: "VariableLocation";
  name: string;
  span: SourceSpan;
  nameSpan: SourceSpan;
};

export type ArrayLocation = {
  kind: "ArrayLocation";
  name: string;
  index: Expression;
  span: SourceSpan;
  nameSpan: SourceSpan;
};

export type Location = VariableLocation | ArrayLocation;

export type CallStatement = {
  kind: "CallStatement";
  callKind: CallKind;
  name: string;
  span: SourceSpan;
  nameSpan: SourceSpan;
};

export type UpdateStatement = {
  kind: "UpdateStatement";
  operator: "+=" | "-=" | "^=";
  target: Location;
  expression: Expression;
  span: SourceSpan;
};

export type SwapStatement = {
  kind: "SwapStatement";
  left: Location;
  right: Location;
  span: SourceSpan;
};

export type SkipStatement = {
  kind: "SkipStatement";
  span: SourceSpan;
};

export type IfStatement = {
  kind: "IfStatement";
  entryCondition: Expression;
  thenBranch: readonly Statement[];
  elseBranch: readonly Statement[];
  exitCondition: Expression;
  span: SourceSpan;
};

export type LoopStatement = {
  kind: "LoopStatement";
  entryAssertion: Expression;
  firstBody: readonly Statement[];
  nextBody: readonly Statement[];
  exitTest: Expression;
  span: SourceSpan;
};

export type Statement =
  | CallStatement
  | UpdateStatement
  | SwapStatement
  | SkipStatement
  | IfStatement
  | LoopStatement;

export type VariableDeclaration = {
  kind: "VariableDeclaration";
  variableKind: "scalar" | "array";
  name: string;
  length: number;
  span: SourceSpan;
  nameSpan: SourceSpan;
};

export type ProcedureDeclaration = {
  kind: "ProcedureDeclaration";
  name: string;
  body: readonly Statement[];
  span: SourceSpan;
  nameSpan: SourceSpan;
};

export type JanusModule = {
  kind: "Module";
  declarations: readonly VariableDeclaration[];
  procedures: readonly ProcedureDeclaration[];
  span: SourceSpan;
};
