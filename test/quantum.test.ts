import { describe, expect, it } from "vitest";
import { compileHostModule, deriveHostPlan } from "../src/host";
import { checkStatic, compileJanus, linkNames, parse } from "../src/janus";
import {
  ADDER_GATE_DEFINITIONS,
  ADDER_PROCEDURE,
  ADDER_SOURCE,
  ADDER_WIRES,
  AdderDemoRuntime,
  adderGateDefinitions,
  adderWires,
  inverseGate,
  QFT_GATE_DEFINITIONS,
  QFT_PROCEDURE,
  QFT_SOURCE,
  QFT_WIRES,
  QftDemoRuntime,
  QftStateVector,
  QuantumGateCatalog,
  qftGateDefinitions,
  qftWires,
  quantumGateEqual,
  specializeAdderSource,
  specializeQftSource,
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

  it("uncalls from an edited phase output and can be called again", async () => {
    const runtime = new QftDemoRuntime(5);
    await runtime.call();
    runtime.editCalledOutput(2);
    await runtime.uncall();

    const edited = runtime.getSnapshot();
    expect(edited.phase).toBe("restored");
    expect(edited.input).toBe(2);
    edited.amplitudes.forEach(({ basis, probability }) => {
      expectClose(probability, basis === 2 ? 1 : 0);
    });

    await runtime.call();
    expect(runtime.getSnapshot()).toMatchObject({
      phase: "called",
      input: 2,
      outputInput: 2,
    });
    expect(runtime.getSnapshot().forwardSteps).toHaveLength(7);
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

  it("subtracts from an edited sum and can be called again", async () => {
    const runtime = new AdderDemoRuntime(5, 11);
    await runtime.call();
    runtime.editCalledOutputB(7);
    await runtime.uncall();

    expect(runtime.getSnapshot()).toMatchObject({
      phase: "restored",
      inputA: 5,
      inputB: 2,
      basis: { a: 5, b: 2, ancilla: 0 },
    });

    await runtime.call();
    expect(runtime.getSnapshot()).toMatchObject({
      phase: "called",
      inputA: 5,
      inputB: 2,
      basis: { a: 5, b: 7, ancilla: 0 },
    });
    expect(runtime.getSnapshot().forwardSteps).toHaveLength(24);
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

describe("width-generic Janus quantum sources", () => {
  it("uses valid Janus data, conditionals, and reversible loops", () => {
    const qft = linkNames(checkStatic(parse(QFT_SOURCE)), [
      { name: "h_at_target", hasForward: true, hasBackward: true },
      {
        name: "cp_at_control_target",
        hasForward: true,
        hasBackward: true,
      },
      { name: "swap_at_index", hasForward: true, hasBackward: true },
    ]);
    const adder = linkNames(checkStatic(parse(ADDER_SOURCE)), [
      { name: "maj_at_index", hasForward: true, hasBackward: true },
      { name: "uma_at_index", hasForward: true, hasBackward: true },
    ]);

    expect(qft.declarations.map(({ name }) => name)).toEqual([
      "length",
      "target",
      "control",
      "swap_index",
    ]);
    expect(qft.procedures[0]?.body[0]).toMatchObject({ kind: "IfStatement" });
    expect(adder.declarations.map(({ name }) => name)).toEqual([
      "length",
      "index",
    ]);
    expect(adder.procedures[0]?.body[0]).toMatchObject({ kind: "IfStatement" });
  });

  it("returns every loop index to zero in both directions", () => {
    const qft = compileJanus(`${QFT_SOURCE}

procedure h_at_target()
procedure cp_at_control_target()
procedure swap_at_index()`);
    const adder = compileJanus(`${ADDER_SOURCE}

procedure maj_at_index()
procedure uma_at_index()`);

    for (let length = 0; length <= 8; length += 1) {
      const qftInput = { length, target: 0, control: 0, swap_index: 0 };
      let qftCalled;
      try {
        qftCalled = qft.call(QFT_PROCEDURE, qftInput);
      } catch (error) {
        throw new Error(`QFT loop failed for length ${length}.`, { cause: error });
      }
      expect(qftCalled).toEqual(qftInput);
      expect(qft.uncall(QFT_PROCEDURE, qftCalled)).toEqual(qftInput);

      const adderInput = { length, index: 0 };
      const adderCalled = adder.call(ADDER_PROCEDURE, adderInput);
      expect(adderCalled).toEqual(adderInput);
      expect(adder.uncall(ADDER_PROCEDURE, adderCalled)).toEqual(adderInput);
    }
  });

  it("specializes the same QFT loop algorithm across logical widths", () => {
    for (let width = 1; width <= 8; width += 1) {
      const catalog = new QuantumGateCatalog(
        qftWires(width),
        qftGateDefinitions(width),
      );
      const registry = catalog.createPrimitiveRegistry({
        emit: async () => undefined,
      });
      const module = compileHostModule(specializeQftSource(width), registry);
      const forward = deriveHostPlan(module, QFT_PROCEDURE, "forward");
      const backward = deriveHostPlan(module, QFT_PROCEDURE, "backward");
      const expectedGateCount =
        width + (width * (width - 1)) / 2 + Math.floor(width / 2);

      expect(forward).toHaveLength(expectedGateCount);
      expect(backward.map(({ primitiveName }) => primitiveName)).toEqual(
        forward.map(({ primitiveName }) => primitiveName).reverse(),
      );
    }
  });

  it("specializes the same MAJ/UMA loop algorithm across logical widths", () => {
    for (let width = 1; width <= 8; width += 1) {
      const catalog = new QuantumGateCatalog(
        adderWires(width),
        adderGateDefinitions(width),
      );
      const registry = catalog.createPrimitiveRegistry({
        emit: async () => undefined,
      });
      const module = compileHostModule(specializeAdderSource(width), registry);
      const forward = deriveHostPlan(module, ADDER_PROCEDURE, "forward");
      const backward = deriveHostPlan(module, ADDER_PROCEDURE, "backward");

      expect(forward).toHaveLength(width * 6);
      expect(backward.map(({ primitiveName }) => primitiveName)).toEqual(
        forward.map(({ primitiveName }) => primitiveName).reverse(),
      );
    }
  });
});
