import { compileHostModule, HostExecutor } from "../host";
import {
  ADDER_GATE_DEFINITIONS,
  ADDER_PROCEDURE,
  ADDER_SOURCE,
  ADDER_WIRES,
} from "./adder-source";
import {
  AdderBasisSimulator,
  type AdderBasisSnapshot,
} from "./basis-simulator";
import {
  inverseGate,
  QuantumGateCatalog,
  type QuantumGate,
  type QuantumGateEmission,
} from "./gates";
import {
  QFT_GATE_DEFINITIONS,
  QFT_PROCEDURE,
  QFT_SOURCE,
  QFT_WIRES,
} from "./qft-source";
import {
  QftStateVector,
  type ComplexAmplitude,
} from "./state-vector";

export type QuantumRuntimePhase =
  | "ready"
  | "running-forward"
  | "called"
  | "running-backward"
  | "restored"
  | "error";

export type QuantumExecutionStep = {
  readonly step: number;
  readonly primitiveName: string;
  readonly gate: QuantumGate;
  readonly direction: "forward" | "backward";
};

export type QuantumRuntimeOptions = {
  readonly delayMilliseconds?: number;
  readonly onChange?: () => void;
};

type Simulator<Snapshot> = {
  apply(gate: QuantumGate): void;
  readonly snapshot: Snapshot;
};

type RuntimeConfig<Snapshot> = {
  readonly source: string;
  readonly procedure: string;
  readonly catalog: QuantumGateCatalog;
  readonly simulator: Simulator<Snapshot>;
  readonly validateCalled: (snapshot: Snapshot) => void;
  readonly validateRestored: (snapshot: Snapshot) => void;
  readonly options: QuantumRuntimeOptions;
};

const copiedGate = (gate: QuantumGate): QuantumGate =>
  inverseGate(inverseGate(gate));

class QuantumProcedureRuntime<Snapshot> {
  readonly source: string;
  readonly procedure: string;
  readonly catalog: QuantumGateCatalog;
  readonly #simulator: Simulator<Snapshot>;
  readonly #validateCalled: (snapshot: Snapshot) => void;
  readonly #validateRestored: (snapshot: Snapshot) => void;
  readonly #delayMilliseconds: number;
  readonly #onChange: (() => void) | undefined;
  readonly #executor: HostExecutor;
  readonly #forwardSteps: QuantumExecutionStep[] = [];
  readonly #backwardSteps: QuantumExecutionStep[] = [];
  #phase: QuantumRuntimePhase = "ready";
  #current: QuantumExecutionStep | undefined;
  #error: string | undefined;

  constructor(config: RuntimeConfig<Snapshot>) {
    this.source = config.source;
    this.procedure = config.procedure;
    this.catalog = config.catalog;
    this.#simulator = config.simulator;
    this.#validateCalled = config.validateCalled;
    this.#validateRestored = config.validateRestored;
    this.#delayMilliseconds = config.options.delayMilliseconds ?? 0;
    this.#onChange = config.options.onChange;
    if (
      !Number.isFinite(this.#delayMilliseconds) ||
      this.#delayMilliseconds < 0
    ) {
      throw new RangeError("Quantum gate delay must be a non-negative number.");
    }

    const registry = this.catalog.createPrimitiveRegistry({
      emit: (emission) => this.#emit(emission),
    });
    const module = compileHostModule(this.source, registry);
    this.#executor = new HostExecutor(module, registry);
  }

  get phase(): QuantumRuntimePhase {
    return this.#phase;
  }

  get simulatorSnapshot(): Snapshot {
    return this.#simulator.snapshot;
  }

  get forwardSteps(): readonly QuantumExecutionStep[] {
    return this.#forwardSteps.map((step) => ({
      ...step,
      gate: copiedGate(step.gate),
    }));
  }

  get backwardSteps(): readonly QuantumExecutionStep[] {
    return this.#backwardSteps.map((step) => ({
      ...step,
      gate: copiedGate(step.gate),
    }));
  }

  get currentStep(): QuantumExecutionStep | undefined {
    return this.#current === undefined
      ? undefined
      : { ...this.#current, gate: copiedGate(this.#current.gate) };
  }

  get error(): string | undefined {
    return this.#error;
  }

  async call(): Promise<void> {
    if (this.#phase !== "ready") {
      throw new Error("Reset the quantum demo before calling it again.");
    }
    this.#phase = "running-forward";
    this.#error = undefined;
    this.#notify();
    const result = await this.#executor.call(this.procedure);
    if (result.status === "failed") {
      this.#fail(result.error.message);
    }
    try {
      this.#validateCalled(this.#simulator.snapshot);
      this.#phase = "called";
      this.#current = undefined;
      this.#notify();
    } catch (error) {
      this.#fail(error instanceof Error ? error.message : String(error));
    }
  }

  async uncall(): Promise<void> {
    if (this.#phase !== "called") {
      throw new Error("Call the quantum procedure before uncalling it.");
    }
    this.#phase = "running-backward";
    this.#error = undefined;
    this.#notify();
    const result = await this.#executor.uncall(this.procedure);
    if (result.status === "failed") {
      this.#fail(result.error.message);
    }
    try {
      this.#validateRestored(this.#simulator.snapshot);
      this.#phase = "restored";
      this.#current = undefined;
      this.#notify();
    } catch (error) {
      this.#fail(error instanceof Error ? error.message : String(error));
    }
  }

  async #emit(emission: QuantumGateEmission): Promise<void> {
    this.#simulator.apply(emission.gate);
    const stream =
      emission.direction === "forward"
        ? this.#forwardSteps
        : this.#backwardSteps;
    const step: QuantumExecutionStep = {
      step: stream.length + 1,
      primitiveName: emission.primitiveName,
      gate: copiedGate(emission.gate),
      direction: emission.direction,
    };
    stream.push(step);
    this.#current = step;
    this.#notify();
    if (this.#delayMilliseconds > 0) {
      await new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, this.#delayMilliseconds);
      });
    }
  }

  #fail(message: string): never {
    this.#phase = "error";
    this.#error = message;
    this.#current = undefined;
    this.#notify();
    throw new Error(message);
  }

  #notify(): void {
    this.#onChange?.();
  }
}

export type QftRuntimeSnapshot = {
  readonly input: number;
  readonly phase: QuantumRuntimePhase;
  readonly amplitudes: readonly ComplexAmplitude[];
  readonly norm: number;
  readonly forwardSteps: readonly QuantumExecutionStep[];
  readonly backwardSteps: readonly QuantumExecutionStep[];
  readonly currentStep?: QuantumExecutionStep;
  readonly error?: string;
};

type QftSimulationSnapshot = {
  readonly amplitudes: readonly ComplexAmplitude[];
  readonly norm: number;
};

export class QftDemoRuntime {
  readonly input: number;
  readonly source = QFT_SOURCE;
  readonly wires = QFT_WIRES;
  readonly #stateVector: QftStateVector;
  readonly #runtime: QuantumProcedureRuntime<QftSimulationSnapshot>;

  constructor(input: number, options: QuantumRuntimeOptions = {}) {
    this.input = input;
    this.#stateVector = new QftStateVector(input);
    const stateVector = this.#stateVector;
    const simulator: Simulator<QftSimulationSnapshot> = {
      apply: (gate) => stateVector.apply(gate),
      get snapshot() {
        return {
          amplitudes: stateVector.amplitudes,
          norm: stateVector.norm,
        };
      },
    };
    this.#runtime = new QuantumProcedureRuntime({
      source: QFT_SOURCE,
      procedure: QFT_PROCEDURE,
      catalog: new QuantumGateCatalog(QFT_WIRES, QFT_GATE_DEFINITIONS),
      simulator,
      validateCalled: ({ amplitudes, norm }) => {
        if (Math.abs(norm - 1) > 1e-10) {
          throw new Error("QFT state-vector norm is not one.");
        }
        if (
          amplitudes.some(
            ({ probability }) => Math.abs(probability - 1 / 8) > 1e-10,
          )
        ) {
          throw new Error("QFT probabilities are not uniform.");
        }
      },
      validateRestored: ({ amplitudes, norm }) => {
        if (Math.abs(norm - 1) > 1e-10) {
          throw new Error("Restored QFT state-vector norm is not one.");
        }
        amplitudes.forEach(({ basis, probability }) => {
          const expected = basis === input ? 1 : 0;
          if (Math.abs(probability - expected) > 1e-10) {
            throw new Error("Inverse QFT did not restore the input basis state.");
          }
        });
      },
      options,
    });
  }

  call(): Promise<void> {
    return this.#runtime.call();
  }

  uncall(): Promise<void> {
    return this.#runtime.uncall();
  }

  getSnapshot(): QftRuntimeSnapshot {
    const simulation = this.#runtime.simulatorSnapshot;
    const currentStep = this.#runtime.currentStep;
    const error = this.#runtime.error;
    return {
      input: this.input,
      phase: this.#runtime.phase,
      amplitudes: simulation.amplitudes.map((amplitude) => ({ ...amplitude })),
      norm: simulation.norm,
      forwardSteps: this.#runtime.forwardSteps,
      backwardSteps: this.#runtime.backwardSteps,
      ...(currentStep === undefined ? {} : { currentStep }),
      ...(error === undefined ? {} : { error }),
    };
  }
}

export type AdderRuntimeSnapshot = {
  readonly inputA: number;
  readonly inputB: number;
  readonly phase: QuantumRuntimePhase;
  readonly basis: AdderBasisSnapshot;
  readonly forwardSteps: readonly QuantumExecutionStep[];
  readonly backwardSteps: readonly QuantumExecutionStep[];
  readonly currentStep?: QuantumExecutionStep;
  readonly error?: string;
};

export class AdderDemoRuntime {
  readonly inputA: number;
  readonly inputB: number;
  readonly source = ADDER_SOURCE;
  readonly wires = ADDER_WIRES;
  readonly #basis: AdderBasisSimulator;
  readonly #runtime: QuantumProcedureRuntime<AdderBasisSnapshot>;

  constructor(inputA: number, inputB: number, options: QuantumRuntimeOptions = {}) {
    this.inputA = inputA;
    this.inputB = inputB;
    this.#basis = new AdderBasisSimulator(inputA, inputB);
    const basis = this.#basis;
    const simulator: Simulator<AdderBasisSnapshot> = {
      apply: (gate) => basis.apply(gate),
      get snapshot() {
        return basis.snapshot;
      },
    };
    this.#runtime = new QuantumProcedureRuntime({
      source: ADDER_SOURCE,
      procedure: ADDER_PROCEDURE,
      catalog: new QuantumGateCatalog(ADDER_WIRES, ADDER_GATE_DEFINITIONS),
      simulator,
      validateCalled: (snapshot) => {
        if (snapshot.a !== inputA) {
          throw new Error("Adder changed register a.");
        }
        if (snapshot.b !== (inputA + inputB) % 16) {
          throw new Error("Adder produced the wrong modulo-16 sum.");
        }
        if (snapshot.ancilla !== 0) {
          throw new Error("Adder carry ancilla is not clean.");
        }
      },
      validateRestored: (snapshot) => {
        if (
          snapshot.a !== inputA ||
          snapshot.b !== inputB ||
          snapshot.ancilla !== 0
        ) {
          throw new Error("Inverse adder did not restore the full basis state.");
        }
      },
      options,
    });
  }

  call(): Promise<void> {
    return this.#runtime.call();
  }

  uncall(): Promise<void> {
    return this.#runtime.uncall();
  }

  getSnapshot(): AdderRuntimeSnapshot {
    const currentStep = this.#runtime.currentStep;
    const error = this.#runtime.error;
    return {
      inputA: this.inputA,
      inputB: this.inputB,
      phase: this.#runtime.phase,
      basis: this.#runtime.simulatorSnapshot,
      forwardSteps: this.#runtime.forwardSteps,
      backwardSteps: this.#runtime.backwardSteps,
      ...(currentStep === undefined ? {} : { currentStep }),
      ...(error === undefined ? {} : { error }),
    };
  }
}
