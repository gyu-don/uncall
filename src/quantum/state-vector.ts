import type { QuantumGate } from "./gates";

export type ComplexAmplitude = {
  readonly basis: number;
  readonly real: number;
  readonly imaginary: number;
  readonly magnitude: number;
  readonly probability: number;
  readonly phase: number;
};

const bitIndex = (wire: string): number => {
  const match = /^q([0-2])$/u.exec(wire);
  if (match?.[1] === undefined) {
    throw new Error(`Unknown QFT wire ${JSON.stringify(wire)}.`);
  }
  return Number(match[1]);
};

export class QftStateVector {
  readonly #real = new Float64Array(8);
  readonly #imaginary = new Float64Array(8);

  constructor(readonly input: number) {
    if (!Number.isInteger(input) || input < 0 || input > 7) {
      throw new RangeError("QFT input must be an integer from 0 to 7.");
    }
    this.#real[input] = 1;
  }

  apply(gate: QuantumGate): void {
    switch (gate.kind) {
      case "h":
        this.#applyHadamard(bitIndex(gate.target));
        break;
      case "cp":
        this.#applyControlledPhase(
          bitIndex(gate.control),
          bitIndex(gate.target),
          gate.angle,
        );
        break;
      case "swap":
        this.#applySwap(bitIndex(gate.targets[0]), bitIndex(gate.targets[1]));
        break;
      default:
        throw new Error(`Gate ${gate.kind} is not supported by the QFT simulator.`);
    }
    const error = Math.abs(this.norm - 1);
    if (error > 1e-10) {
      throw new Error(`State-vector norm drifted by ${error}.`);
    }
  }

  get norm(): number {
    let sum = 0;
    for (let index = 0; index < 8; index += 1) {
      const real = this.#real[index] ?? 0;
      const imaginary = this.#imaginary[index] ?? 0;
      sum += real * real + imaginary * imaginary;
    }
    return sum;
  }

  get amplitudes(): readonly ComplexAmplitude[] {
    return Array.from({ length: 8 }, (_, basis) => {
      const real = this.#real[basis] ?? 0;
      const imaginary = this.#imaginary[basis] ?? 0;
      const probability = real * real + imaginary * imaginary;
      return {
        basis,
        real,
        imaginary,
        magnitude: Math.sqrt(probability),
        probability,
        phase: probability < 1e-20 ? 0 : Math.atan2(imaginary, real),
      };
    });
  }

  #applyHadamard(target: number): void {
    const mask = 1 << target;
    const scale = 1 / Math.sqrt(2);
    for (let zero = 0; zero < 8; zero += 1) {
      if ((zero & mask) !== 0) continue;
      const one = zero | mask;
      const zeroReal = this.#real[zero] ?? 0;
      const zeroImaginary = this.#imaginary[zero] ?? 0;
      const oneReal = this.#real[one] ?? 0;
      const oneImaginary = this.#imaginary[one] ?? 0;
      this.#real[zero] = (zeroReal + oneReal) * scale;
      this.#imaginary[zero] = (zeroImaginary + oneImaginary) * scale;
      this.#real[one] = (zeroReal - oneReal) * scale;
      this.#imaginary[one] = (zeroImaginary - oneImaginary) * scale;
    }
  }

  #applyControlledPhase(control: number, target: number, angle: number): void {
    const mask = (1 << control) | (1 << target);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    for (let index = 0; index < 8; index += 1) {
      if ((index & mask) !== mask) continue;
      const real = this.#real[index] ?? 0;
      const imaginary = this.#imaginary[index] ?? 0;
      this.#real[index] = real * cosine - imaginary * sine;
      this.#imaginary[index] = real * sine + imaginary * cosine;
    }
  }

  #applySwap(first: number, second: number): void {
    if (first === second) return;
    const firstMask = 1 << first;
    const secondMask = 1 << second;
    for (let index = 0; index < 8; index += 1) {
      const firstBit = (index & firstMask) !== 0;
      const secondBit = (index & secondMask) !== 0;
      if (firstBit || !secondBit) continue;
      const swapped = (index | firstMask) & ~secondMask;
      const real = this.#real[index] ?? 0;
      const imaginary = this.#imaginary[index] ?? 0;
      this.#real[index] = this.#real[swapped] ?? 0;
      this.#imaginary[index] = this.#imaginary[swapped] ?? 0;
      this.#real[swapped] = real;
      this.#imaginary[swapped] = imaginary;
    }
  }
}
