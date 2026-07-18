import type { QuantumGateDefinition, QubitId } from "./gates";

export const ADDER_PROCEDURE = "add";
export const ADDER_WIDTH = 4;

/**
 * Width-generic Janus algorithm. `maj_at_index` and `uma_at_index` are
 * index-aware adapter primitives that are specialized to concrete logical
 * CNOT/Toffoli calls before the calls-only HostExecutor runs the UI circuit.
 */
export const ADDER_SOURCE = `length index

procedure add()
    if length > 0 then
        from index = 0 do
            call maj_at_index()
        loop
            index += 1
        until index = (length - 1)

        from index = (length - 1) do
            call uma_at_index()
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

const cx = (control: QubitId, target: QubitId): QuantumGateDefinition => ({
  name: `cx_${control}_${target}`,
  gate: { kind: "cx", control, target },
});

const ccx = (
  first: QubitId,
  second: QubitId,
  target: QubitId,
): QuantumGateDefinition => ({
  name: `ccx_${first}_${second}_${target}`,
  gate: { kind: "ccx", controls: [first, second], target },
});

const majorityDefinitions = (bit: number): readonly QuantumGateDefinition[] => {
  const a = `a${bit}`;
  const b = `b${bit}`;
  const carry = previousCarry(bit);
  return [cx(a, b), cx(a, carry), ccx(carry, b, a)];
};

const unmajorityDefinitions = (bit: number): readonly QuantumGateDefinition[] => {
  const a = `a${bit}`;
  const b = `b${bit}`;
  const carry = previousCarry(bit);
  return [ccx(carry, b, a), cx(a, carry), cx(carry, b)];
};

export const adderGateDefinitions = (
  width: number,
): readonly QuantumGateDefinition[] => {
  checkedWidth(width);
  const unique = new Map<string, QuantumGateDefinition>();
  for (let bit = 0; bit < width; bit += 1) {
    for (const definition of majorityDefinitions(bit)) {
      unique.set(definition.name, definition);
    }
    for (const definition of unmajorityDefinitions(bit)) {
      unique.set(definition.name, definition);
    }
  }
  return [...unique.values()];
};

export const ADDER_GATE_DEFINITIONS = adderGateDefinitions(ADDER_WIDTH);

const callsFor = (definitions: readonly QuantumGateDefinition[]): string =>
  definitions.map(({ name }) => `    call ${name}()`).join("\n");

/** Specializes the loop/index operations above to today's fixed UI width. */
export const specializeAdderSource = (width: number): string => {
  checkedWidth(width);
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
      `procedure maj_${bit}()\n${callsFor(majorityDefinitions(bit))}`,
      `procedure uma_${bit}()\n${callsFor(unmajorityDefinitions(bit))}`,
    );
  }
  return [
    `procedure ${ADDER_PROCEDURE}()\n    call carry_chain()\n    call sum_chain()`,
    `procedure carry_chain()\n${carryCalls.join("\n")}`,
    `procedure sum_chain()\n${sumCalls.join("\n")}`,
    ...bitProcedures,
  ].join("\n\n");
};

export const ADDER_HOST_SOURCE = specializeAdderSource(ADDER_WIDTH);
