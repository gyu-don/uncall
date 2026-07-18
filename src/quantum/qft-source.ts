import type { QuantumGateDefinition, QubitId } from "./gates";

export const QFT_PROCEDURE = "qft";
export const QFT_WIDTH = 3;

/**
 * Width-generic Janus source shown in the demo. The quantum adapter specializes
 * the index-aware primitives to concrete, argument-free host primitive names.
 * As with the sort demo, `length` is logical input while the UI chooses one
 * fixed supported allocation for visualization.
 */
export const QFT_SOURCE = `length target control swap_index

procedure qft()
    if length > 0 then
        target += length - 1
        from target = (length - 1) do
            call h_at_target()
            if target > 0 then
                control += target
                control -= 1
                from control = (target - 1) do
                    call cp_at_control_target()
                loop
                    control -= 1
                until control = 0
            else skip
            fi target > 0
        loop
            target -= 1
        until target = 0
        call reverse_qubit_order()
    else skip
    fi length > 0

procedure reverse_qubit_order()
    if length > 1 then
        from swap_index = 0 do
            call swap_at_index()
        loop
            swap_index += 1
        until swap_index = (length / 2 - 1)
        swap_index -= length / 2
        swap_index += 1
    else skip
    fi length > 1`;

const checkedWidth = (width: number): number => {
  if (!Number.isSafeInteger(width) || width < 1 || width > 30) {
    throw new RangeError("QFT specialization width must be from 1 to 30.");
  }
  return width;
};

export const qftWires = (width: number): readonly QubitId[] =>
  Array.from({ length: checkedWidth(width) }, (_, bit) => `q${bit}`);

export const QFT_WIRES = qftWires(QFT_WIDTH);

const hName = (target: number): string => `h_q${target}`;
const cpName = (control: number, target: number): string =>
  `cp_pi_${2 ** (target - control)}_q${control}_q${target}`;
const swapName = (first: number, second: number): string =>
  `swap_q${first}_q${second}`;

export const qftGateDefinitions = (
  width: number,
): readonly QuantumGateDefinition[] => {
  checkedWidth(width);
  const definitions: QuantumGateDefinition[] = [];
  for (let target = width - 1; target >= 0; target -= 1) {
    definitions.push({
      name: hName(target),
      gate: { kind: "h", target: `q${target}` },
    });
    for (let control = target - 1; control >= 0; control -= 1) {
      definitions.push({
        name: cpName(control, target),
        gate: {
          kind: "cp",
          control: `q${control}`,
          target: `q${target}`,
          angle: Math.PI / 2 ** (target - control),
        },
      });
    }
  }
  for (let first = 0; first < Math.floor(width / 2); first += 1) {
    const second = width - first - 1;
    definitions.push({
      name: swapName(first, second),
      gate: { kind: "swap", targets: [`q${first}`, `q${second}`] },
    });
  }
  return definitions;
};

export const QFT_GATE_DEFINITIONS = qftGateDefinitions(QFT_WIDTH);

/** Specializes the loop/index operations above to today's fixed UI width. */
export const specializeQftSource = (width: number): string => {
  checkedWidth(width);
  const topLevelCalls: string[] = [];
  const procedures: string[] = [];
  for (let target = width - 1; target >= 0; target -= 1) {
    topLevelCalls.push(`    call qft_target_${target}()`);
    const calls = [`    call ${hName(target)}()`];
    for (let control = target - 1; control >= 0; control -= 1) {
      calls.push(`    call ${cpName(control, target)}()`);
    }
    procedures.push(`procedure qft_target_${target}()\n${calls.join("\n")}`);
  }
  topLevelCalls.push("    call reverse_qubit_order()");
  const swapCalls: string[] = [];
  for (let first = 0; first < Math.floor(width / 2); first += 1) {
    swapCalls.push(`    call ${swapName(first, width - first - 1)}()`);
  }
  return [
    `procedure ${QFT_PROCEDURE}()\n${topLevelCalls.join("\n")}`,
    ...procedures,
    `procedure reverse_qubit_order()${swapCalls.length === 0 ? "" : `\n${swapCalls.join("\n")}`}`,
  ].join("\n\n");
};

export const QFT_HOST_SOURCE = specializeQftSource(QFT_WIDTH);
