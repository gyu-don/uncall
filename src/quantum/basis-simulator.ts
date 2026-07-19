import type { QuantumGate, QubitId } from "./gates";

export type AdderBasisSnapshot = {
  readonly a: number;
  readonly b: number;
  readonly ancilla: number;
  readonly bits: Readonly<Record<QubitId, 0 | 1>>;
};

const checkedInput = (name: string, value: number): number => {
  if (!Number.isInteger(value) || value < 0 || value > 15) {
    throw new RangeError(`${name} must be an integer from 0 to 15.`);
  }
  return value;
};

export class AdderBasisSimulator {
  readonly #bits = new Map<QubitId, 0 | 1>();

  constructor(readonly inputA: number, readonly inputB: number) {
    checkedInput("a", inputA);
    checkedInput("b", inputB);
    for (let bit = 0; bit < 4; bit += 1) {
      this.#bits.set(`a${bit}`, ((inputA >> bit) & 1) as 0 | 1);
      this.#bits.set(`b${bit}`, ((inputB >> bit) & 1) as 0 | 1);
    }
    this.#bits.set("c0", 0);
  }

  apply(gate: QuantumGate): void {
    switch (gate.kind) {
      case "x":
        this.#flip(gate.target);
        return;
      case "cx":
        if (this.#read(gate.control) === 1) this.#flip(gate.target);
        return;
      case "ccx":
        if (
          this.#read(gate.controls[0]) === 1 &&
          this.#read(gate.controls[1]) === 1
        ) {
          this.#flip(gate.target);
        }
        return;
      default:
        throw new Error(
          `Gate ${gate.kind} is not supported by the basis-state simulator.`,
        );
    }
  }

  setOutputB(value: number): void {
    checkedInput("Adder output b", value);
    if (this.#read("c0") !== 0) {
      throw new Error("Adder output can only be edited with a clean carry ancilla.");
    }
    for (let bit = 0; bit < 4; bit += 1) {
      this.#bits.set(`b${bit}`, ((value >> bit) & 1) as 0 | 1);
    }
  }

  get snapshot(): AdderBasisSnapshot {
    const bits = Object.fromEntries(this.#bits) as Record<QubitId, 0 | 1>;
    return {
      a: this.#register("a"),
      b: this.#register("b"),
      ancilla: this.#read("c0"),
      bits,
    };
  }

  #register(prefix: "a" | "b"): number {
    let value = 0;
    for (let bit = 0; bit < 4; bit += 1) {
      value |= this.#read(`${prefix}${bit}`) << bit;
    }
    return value;
  }

  #read(wire: QubitId): 0 | 1 {
    const value = this.#bits.get(wire);
    if (value === undefined) {
      throw new Error(`Unknown basis-state wire ${JSON.stringify(wire)}.`);
    }
    return value;
  }

  #flip(wire: QubitId): void {
    this.#bits.set(wire, this.#read(wire) === 0 ? 1 : 0);
  }
}
