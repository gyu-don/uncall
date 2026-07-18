import type { QuantumGateDefinition, QubitId } from "./gates";

export const ADDER_PROCEDURE = "add4";
export const ADDER_WIRES = [
  "a0",
  "a1",
  "a2",
  "a3",
  "b0",
  "b1",
  "b2",
  "b3",
  "c0",
] as const satisfies readonly QubitId[];

export const ADDER_SOURCE = `procedure add4()
    call carry_chain()
    call sum_chain()

procedure carry_chain()
    call maj_0()
    call maj_1()
    call maj_2()
    call maj_3()

procedure sum_chain()
    call uma_3()
    call uma_2()
    call uma_1()
    call uma_0()

procedure maj_0()
    call cx_a0_b0()
    call cx_a0_c0()
    call ccx_c0_b0_a0()

procedure maj_1()
    call cx_a1_b1()
    call cx_a1_a0()
    call ccx_a0_b1_a1()

procedure maj_2()
    call cx_a2_b2()
    call cx_a2_a1()
    call ccx_a1_b2_a2()

procedure maj_3()
    call cx_a3_b3()
    call cx_a3_a2()
    call ccx_a2_b3_a3()

procedure uma_3()
    call ccx_a2_b3_a3()
    call cx_a3_a2()
    call cx_a2_b3()

procedure uma_2()
    call ccx_a1_b2_a2()
    call cx_a2_a1()
    call cx_a1_b2()

procedure uma_1()
    call ccx_a0_b1_a1()
    call cx_a1_a0()
    call cx_a0_b1()

procedure uma_0()
    call ccx_c0_b0_a0()
    call cx_a0_c0()
    call cx_c0_b0()`;

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

export const ADDER_GATE_DEFINITIONS: readonly QuantumGateDefinition[] = [
  cx("a0", "b0"),
  cx("a0", "c0"),
  ccx("c0", "b0", "a0"),
  cx("a1", "b1"),
  cx("a1", "a0"),
  ccx("a0", "b1", "a1"),
  cx("a2", "b2"),
  cx("a2", "a1"),
  ccx("a1", "b2", "a2"),
  cx("a3", "b3"),
  cx("a3", "a2"),
  ccx("a2", "b3", "a3"),
  cx("a2", "b3"),
  cx("a1", "b2"),
  cx("a0", "b1"),
  cx("c0", "b0"),
];
