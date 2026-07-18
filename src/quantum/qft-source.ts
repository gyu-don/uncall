import type { QuantumGateDefinition, QubitId } from "./gates";

export const QFT_PROCEDURE = "qft3";
export const QFT_WIRES = ["q0", "q1", "q2"] as const satisfies readonly QubitId[];

export const QFT_SOURCE = `procedure qft3()
    call qft_high_bit()
    call qft_middle_bit()
    call h_q0()
    call swap_q0_q2()

procedure qft_high_bit()
    call h_q2()
    call cp_pi_2_q1_q2()
    call cp_pi_4_q0_q2()

procedure qft_middle_bit()
    call h_q1()
    call cp_pi_2_q0_q1()`;

export const QFT_GATE_DEFINITIONS: readonly QuantumGateDefinition[] = [
  { name: "h_q2", gate: { kind: "h", target: "q2" } },
  {
    name: "cp_pi_2_q1_q2",
    gate: { kind: "cp", control: "q1", target: "q2", angle: Math.PI / 2 },
  },
  {
    name: "cp_pi_4_q0_q2",
    gate: { kind: "cp", control: "q0", target: "q2", angle: Math.PI / 4 },
  },
  { name: "h_q1", gate: { kind: "h", target: "q1" } },
  {
    name: "cp_pi_2_q0_q1",
    gate: { kind: "cp", control: "q0", target: "q1", angle: Math.PI / 2 },
  },
  { name: "h_q0", gate: { kind: "h", target: "q0" } },
  {
    name: "swap_q0_q2",
    gate: { kind: "swap", targets: ["q0", "q2"] },
  },
];
