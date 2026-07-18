import type { Direction } from "../janus/ast";
import type {
  ResolvedModule,
  ResolvedProcedure,
  ResolvedStatement,
} from "../janus/resolver";

export type HostPlanStep = {
  readonly primitiveName: string;
  readonly direction: Direction;
};

const reverseDirection = (direction: Direction): Direction =>
  direction === "forward" ? "backward" : "forward";

/**
 * Flattens a calls-only host procedure into the primitive operations the
 * executor will perform. The backward plan is therefore derived from the
 * same resolved procedure, rather than maintained as a second workflow.
 */
export const deriveHostPlan = (
  module: ResolvedModule,
  procedureName: string,
  direction: Direction,
): readonly HostPlanStep[] => {
  const procedures = new Map<string, ResolvedProcedure>(
    module.procedures.map((procedure) => [procedure.name, procedure]),
  );
  const steps: HostPlanStep[] = [];

  const visitSequence = (
    statements: readonly ResolvedStatement[],
    executionDirection: Direction,
  ): void => {
    const ordered =
      executionDirection === "forward" ? statements : [...statements].reverse();
    for (const statement of ordered) {
      if (statement.kind !== "CallStatement") {
        throw new Error(`Host plan received unsupported ${statement.kind}`);
      }
      const effectiveDirection =
        statement.callKind === "call"
          ? executionDirection
          : reverseDirection(executionDirection);
      if (statement.target === "primitive") {
        steps.push({ primitiveName: statement.name, direction: effectiveDirection });
        continue;
      }
      const target = procedures.get(statement.name);
      if (target === undefined) {
        throw new Error(`Unknown host procedure ${JSON.stringify(statement.name)}`);
      }
      visitSequence(target.body, effectiveDirection);
    }
  };

  const procedure = procedures.get(procedureName.toLowerCase());
  if (procedure === undefined) {
    throw new Error(`Unknown host procedure ${JSON.stringify(procedureName)}`);
  }
  visitSequence(procedure.body, direction);
  return steps;
};

export const hostPlanHash = (
  procedureName: string,
  forward: readonly HostPlanStep[],
  backward: readonly HostPlanStep[],
): string => {
  const input = JSON.stringify({
    procedureName: procedureName.toLowerCase(),
    forward,
    backward,
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
};
