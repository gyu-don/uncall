import type { BinaryExpression, Expression } from "../janus/ast";

export const evaluateHostArgument = (expression: Expression): number => {
  switch (expression.kind) {
    case "IntegerLiteral":
      return expression.value;
    case "UnaryExpression": {
      const operand = evaluateHostArgument(expression.operand);
      return expression.operator === "-" ? (-operand | 0) : operand === 0 ? -1 : 0;
    }
    case "BinaryExpression":
      return evaluateBinary(expression);
    case "VariableExpression":
    case "ArrayAccessExpression":
      throw new Error("Host primitive arguments must be constant expressions.");
  }
};

const evaluateBinary = (expression: BinaryExpression): number => {
  const left = evaluateHostArgument(expression.left);
  const right = evaluateHostArgument(expression.right);
  switch (expression.operator) {
    case "+":
      return (left + right) | 0;
    case "-":
      return (left - right) | 0;
    case "*":
      return Math.imul(left, right);
    case "**": {
      const result = left ** right;
      if (right < 0 || !Number.isSafeInteger(result)) {
        throw new Error("Host primitive integer power is out of range.");
      }
      return result | 0;
    }
    case "/":
      if (right === 0) throw new Error("Division by zero in host primitive argument.");
      return Math.trunc(left / right) | 0;
    case "\\":
      if (right === 0) throw new Error("Remainder by zero in host primitive argument.");
      return (left - Math.trunc(left / right) * right) | 0;
    case "!":
      return left ^ right;
    case "&":
      return left !== 0 && right !== 0 ? -1 : 0;
    case "|":
      return left !== 0 || right !== 0 ? -1 : 0;
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
};
