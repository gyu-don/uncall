import type {
  ParameterizedQuantumGateDefinition,
  QuantumGate,
  QubitId,
} from "./gates";

export const ADDER_PROCEDURE = "add";
export const ADDER_WIDTH = 4;

/**
 * Canonical width-generic Janus algorithm shown in the demo. The adapter
 * specializes its loop/index expressions to constant gate arguments before
 * the calls-only HostExecutor runs the UI circuit.
 */
export const ADDER_SOURCE = `length index

procedure add()
    if length > 0 then
        from index = 0 do
            call maj(index)
        loop
            index += 1
        until index = (length - 1)

        from index = (length - 1) do
            call uma(index)
        loop
            index -= 1
        until index = 0
    else skip
    fi length > 0`;

const checkedWidth = (width: number): number => {
  if (!Number.isSafeInteger(width) || width < 1 || width > 30) {
    throw new RangeError("Adder specialization width must be from 1 to 30.");
  }
  return width;
};

export const adderWires = (width: number): readonly QubitId[] => {
  checkedWidth(width);
  return [
    ...Array.from({ length: width }, (_, bit) => `a${bit}`),
    ...Array.from({ length: width }, (_, bit) => `b${bit}`),
    "c0",
  ];
};

export const ADDER_WIRES = adderWires(ADDER_WIDTH);

const previousCarry = (bit: number): QubitId =>
  bit === 0 ? "c0" : `a${bit - 1}`;

const cx = (control: QubitId, target: QubitId): QuantumGate => ({
  kind: "cx",
  control,
  target,
});

const ccx = (
  first: QubitId,
  second: QubitId,
  target: QubitId,
): QuantumGate => ({
  kind: "ccx",
  controls: [first, second],
  target,
});

const majorityGates = (bit: number): readonly QuantumGate[] => {
  const a = `a${bit}`;
  const b = `b${bit}`;
  const carry = previousCarry(bit);
  return [cx(a, b), cx(a, carry), ccx(carry, b, a)];
};

const unmajorityGates = (bit: number): readonly QuantumGate[] => {
  const a = `a${bit}`;
  const b = `b${bit}`;
  const carry = previousCarry(bit);
  return [ccx(carry, b, a), cx(a, carry), cx(carry, b)];
};

const wireArgument = (
  arguments_: readonly number[],
  index: number,
  wires: readonly QubitId[],
  label: string,
): QubitId => {
  const value = arguments_[index];
  if (
    value === undefined ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value >= wires.length
  ) {
    throw new RangeError(`${label} must be a wire index from 0 to ${wires.length - 1}.`);
  }
  const wire = wires[value];
  if (wire === undefined) throw new Error("Adder wire lookup invariant failed.");
  return wire;
};

export const adderParameterizedGateDefinitions = (
  width: number,
): readonly ParameterizedQuantumGateDefinition[] => {
  const wires = adderWires(width);
  return [
    {
      name: "cx",
      arity: 2,
      gate: (arguments_) => ({
        kind: "cx",
        control: wireArgument(arguments_, 0, wires, "CX control"),
        target: wireArgument(arguments_, 1, wires, "CX target"),
      }),
    },
    {
      name: "ccx",
      arity: 3,
      gate: (arguments_) => ({
        kind: "ccx",
        controls: [
          wireArgument(arguments_, 0, wires, "CCX first control"),
          wireArgument(arguments_, 1, wires, "CCX second control"),
        ],
        target: wireArgument(arguments_, 2, wires, "CCX target"),
      }),
    },
  ];
};

export const ADDER_PARAMETERIZED_GATE_DEFINITIONS =
  adderParameterizedGateDefinitions(ADDER_WIDTH);

const gateCall = (gate: QuantumGate, wires: readonly QubitId[]): string => {
  const wireIndex = (wire: QubitId): number => {
    const index = wires.indexOf(wire);
    if (index < 0) throw new Error(`Unknown specialized adder wire ${wire}.`);
    return index;
  };
  switch (gate.kind) {
    case "cx":
      return `    call cx(${wireIndex(gate.control)}, ${wireIndex(gate.target)})`;
    case "ccx":
      return `    call ccx(${wireIndex(gate.controls[0])}, ${wireIndex(gate.controls[1])}, ${wireIndex(gate.target)})`;
    default:
      throw new Error(`Unsupported specialized adder gate ${gate.kind}.`);
  }
};

const callsFor = (
  gates: readonly QuantumGate[],
  wires: readonly QubitId[],
): string => gates.map((gate) => gateCall(gate, wires)).join("\n");

/** Specializes the loop/index operations above to today's fixed UI width. */
export const specializeAdderSource = (width: number): string => {
  checkedWidth(width);
  const wires = adderWires(width);
  const carryCalls = Array.from(
    { length: width },
    (_, bit) => `    call maj_${bit}()`,
  );
  const sumCalls = Array.from(
    { length: width },
    (_, offset) => `    call uma_${width - offset - 1}()`,
  );
  const bitProcedures: string[] = [];
  for (let bit = 0; bit < width; bit += 1) {
    bitProcedures.push(
      `procedure maj_${bit}()\n${callsFor(majorityGates(bit), wires)}`,
      `procedure uma_${bit}()\n${callsFor(unmajorityGates(bit), wires)}`,
    );
  }
  return [
    `procedure ${ADDER_PROCEDURE}()\n    call carry_chain()\n    call sum_chain()`,
    `procedure carry_chain()\n${carryCalls.join("\n")}`,
    `procedure sum_chain()\n${sumCalls.join("\n")}`,
    ...bitProcedures,
  ].join("\n\n");
};
