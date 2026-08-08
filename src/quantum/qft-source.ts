import type {
  ParameterizedQuantumGateDefinition,
  QuantumGateDefinition,
  QubitId,
} from "./gates";

export const QFT_PROCEDURE = "qft";
export const QFT_WIDTH = 3;

/**
 * Canonical width-generic Janus source shown in the demo. The quantum adapter
 * specializes its loop/index expressions to constant gate arguments before
 * execution.
 * As with the sort demo, `length` is logical input while the UI chooses one
 * fixed supported allocation for visualization.
 */
export const QFT_SOURCE = `length target control swap_index

procedure qft()
    if length > 0 then
        target += length - 1
        from target = (length - 1) do
            call h(target)
            if target > 0 then
                control += target
                control -= 1
                from control = (target - 1) do
                    call cp_pi(control, target, 1, 2 ** (target - control))
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
            call swap(swap_index, length - swap_index - 1)
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

const qubitArgument = (value: number, label: string, width: number): QubitId => {
  if (!Number.isSafeInteger(value) || value < 0 || value >= width) {
    throw new RangeError(`${label} must be a qubit index from 0 to ${width - 1}.`);
  }
  return `q${value}`;
};

const gateArgument = (
  arguments_: readonly number[],
  index: number,
  label: string,
): number => {
  const value = arguments_[index];
  if (value === undefined) throw new RangeError(`Missing ${label}.`);
  return value;
};

export const qftParameterizedGateDefinitions = (
  width: number,
): readonly ParameterizedQuantumGateDefinition[] => {
  checkedWidth(width);
  return [
    {
      name: "h",
      arity: 1,
      gate: (arguments_) => ({
        kind: "h",
        target: qubitArgument(
          gateArgument(arguments_, 0, "H target"),
          "H target",
          width,
        ),
      }),
    },
    {
      name: "cp_pi",
      arity: 4,
      gate: (arguments_) => {
        const control = gateArgument(arguments_, 0, "CP control");
        const target = gateArgument(arguments_, 1, "CP target");
        const numerator = gateArgument(arguments_, 2, "CP phase numerator");
        const denominator = gateArgument(arguments_, 3, "CP phase denominator");
        if (!Number.isSafeInteger(numerator)) {
          throw new RangeError("CP phase numerator must be an integer.");
        }
        if (!Number.isSafeInteger(denominator) || denominator <= 0) {
          throw new RangeError("CP phase denominator must be a positive integer.");
        }
        return {
          kind: "cp",
          control: qubitArgument(control, "CP control", width),
          target: qubitArgument(target, "CP target", width),
          angle: (Math.PI * numerator) / denominator,
        };
      },
    },
    {
      name: "swap",
      arity: 2,
      gate: (arguments_) => ({
        kind: "swap",
        targets: [
          qubitArgument(
            gateArgument(arguments_, 0, "SWAP first target"),
            "SWAP first target",
            width,
          ),
          qubitArgument(
            gateArgument(arguments_, 1, "SWAP second target"),
            "SWAP second target",
            width,
          ),
        ],
      }),
    },
  ];
};

export const QFT_PARAMETERIZED_GATE_DEFINITIONS =
  qftParameterizedGateDefinitions(QFT_WIDTH);

/** Specializes the loop/index operations above to today's fixed UI width. */
export const specializeQftSource = (width: number): string => {
  checkedWidth(width);
  const topLevelCalls: string[] = [];
  const procedures: string[] = [];
  for (let target = width - 1; target >= 0; target -= 1) {
    topLevelCalls.push(`    call qft_target_${target}()`);
    const calls = [`    call h(${target})`];
    for (let control = target - 1; control >= 0; control -= 1) {
      calls.push(
        `    call cp_pi(${control}, ${target}, 1, ${2 ** (target - control)})`,
      );
    }
    procedures.push(`procedure qft_target_${target}()\n${calls.join("\n")}`);
  }
  topLevelCalls.push("    call reverse_qubit_order()");
  const swapCalls: string[] = [];
  for (let first = 0; first < Math.floor(width / 2); first += 1) {
    swapCalls.push(`    call swap(${first}, ${width - first - 1})`);
  }
  return [
    `procedure ${QFT_PROCEDURE}()\n${topLevelCalls.join("\n")}`,
    ...procedures,
    `procedure reverse_qubit_order()${swapCalls.length === 0 ? "" : `\n${swapCalls.join("\n")}`}`,
  ].join("\n\n");
};
