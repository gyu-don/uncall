import { describe, expect, it } from "vitest";
import { compileHostModule } from "../src/host";
import {
  ADDER_GATE_DEFINITIONS,
  ADDER_WIRES,
  AdderDemoRuntime,
  inverseGate,
  QFT_GATE_DEFINITIONS,
  QFT_WIRES,
  QftDemoRuntime,
  QftStateVector,
  QuantumGateCatalog,
  quantumGateEqual,
  type QuantumGate,
} from "../src/quantum";

const expectClose = (actual: number, expected: number): void => {
  expect(Math.abs(actual - expected)).toBeLessThan(1e-10);
};

describe("three-qubit QFT", () => {
  it("matches the positive-phase QFT formula for every basis input", async () => {
    for (let input = 0; input < 8; input += 1) {
      const runtime = new QftDemoRuntime(input);
      await runtime.call();
      const called = runtime.getSnapshot();

      expect(called.phase).toBe("called");
      expectClose(called.norm, 1);
      for (const amplitude of called.amplitudes) {
        const angle = (2 * Math.PI * input * amplitude.basis) / 8;
        expectClose(amplitude.real, Math.cos(angle) / Math.sqrt(8));
        expectClose(amplitude.imaginary, Math.sin(angle) / Math.sqrt(8));
        expectClose(amplitude.probability, 1 / 8);
      }

      await runtime.uncall();
      const restored = runtime.getSnapshot();
      expect(restored.phase).toBe("restored");
      restored.amplitudes.forEach(({ basis, probability }) => {
        expectClose(probability, basis === input ? 1 : 0);
      });
    }
  });

  it("preserves norm at every fixture gate", () => {
    const gates = QFT_GATE_DEFINITIONS.map(({ gate }) => gate);
    for (let input = 0; input < 8; input += 1) {
      const state = new QftStateVector(input);
      for (const gate of gates) {
        state.apply(gate);
        expectClose(state.norm, 1);
      }
      for (const gate of [...gates].reverse()) {
        state.apply(inverseGate(gate));
        expectClose(state.norm, 1);
      }
    }
  });

  it("emits the fixture sequence and its reverse adjoint", async () => {
    const runtime = new QftDemoRuntime(5);
    await runtime.call();
    await runtime.uncall();
    const snapshot = runtime.getSnapshot();
    const forward = snapshot.forwardSteps.map(({ gate }) => gate);
    const backward = snapshot.backwardSteps.map(({ gate }) => gate);

    expect(snapshot.forwardSteps.map(({ primitiveName }) => primitiveName)).toEqual([
      "h_q2",
      "cp_pi_2_q1_q2",
      "cp_pi_4_q0_q2",
      "h_q1",
      "cp_pi_2_q0_q1",
      "h_q0",
      "swap_q0_q2",
    ]);
    expect(backward).toHaveLength(forward.length);
    backward.forEach((gate, index) => {
      const corresponding = forward.at(-(index + 1));
      expect(corresponding).toBeDefined();
      expect(quantumGateEqual(gate, inverseGate(corresponding as QuantumGate))).toBe(
        true,
      );
    });
  });
});

describe("four-bit Cuccaro-style logical Toffoli adder", () => {
  it("adds modulo 16, cleans carry, and restores all 256 inputs", async () => {
    for (let a = 0; a < 16; a += 1) {
      for (let b = 0; b < 16; b += 1) {
        const runtime = new AdderDemoRuntime(a, b);
        await runtime.call();
        const called = runtime.getSnapshot();
        expect(called.basis).toMatchObject({
          a,
          b: (a + b) % 16,
          ancilla: 0,
        });

        await runtime.uncall();
        expect(runtime.getSnapshot().basis).toMatchObject({ a, b, ancilla: 0 });
      }
    }
  });

  it("emits 24 logical gates and the same descriptors in reverse", async () => {
    const runtime = new AdderDemoRuntime(9, 14);
    await runtime.call();
    await runtime.uncall();
    const snapshot = runtime.getSnapshot();

    expect(snapshot.forwardSteps).toHaveLength(24);
    expect(snapshot.backwardSteps).toHaveLength(24);
    snapshot.backwardSteps.forEach(({ gate, primitiveName }, index) => {
      const corresponding = snapshot.forwardSteps.at(-(index + 1));
      expect(corresponding).toBeDefined();
      expect(primitiveName).toBe(corresponding?.primitiveName);
      expect(quantumGateEqual(gate, corresponding?.gate as QuantumGate)).toBe(true);
      expect(["cx", "ccx"]).toContain(gate.kind);
    });
  });
});

describe("quantum gate catalog validation", () => {
  it("rejects unknown wires, repeated operands, and invalid phase angles", () => {
    expect(
      () =>
        new QuantumGateCatalog(QFT_WIRES, [
          { name: "h_missing", gate: { kind: "h", target: "missing" } },
        ]),
    ).toThrow(/Unknown quantum wire/u);
    expect(
      () =>
        new QuantumGateCatalog(QFT_WIRES, [
          {
            name: "cx_q0_q0",
            gate: { kind: "cx", control: "q0", target: "q0" },
          },
        ]),
    ).toThrow(/same quantum wire/u);
    expect(
      () =>
        new QuantumGateCatalog(QFT_WIRES, [
          {
            name: "cp_bad",
            gate: {
              kind: "cp",
              control: "q0",
              target: "q1",
              angle: Number.NaN,
            },
          },
        ]),
    ).toThrow(/Invalid phase angle/u);
  });

  it("rejects an unregistered primitive before execution", () => {
    const catalog = new QuantumGateCatalog(ADDER_WIRES, ADDER_GATE_DEFINITIONS);
    const registry = catalog.createPrimitiveRegistry({ emit: async () => undefined });
    expect(() =>
      compileHostModule("procedure broken()\n  call x_not_registered()", registry),
    ).toThrow(/Undefined|Unknown|unresolved/u);
  });
});
