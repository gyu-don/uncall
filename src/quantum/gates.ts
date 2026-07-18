import {
  PrimitiveRegistry,
  type HostPrimitiveContext,
} from "../host";

export type QubitId = string;

export type QuantumGate =
  | { readonly kind: "x"; readonly target: QubitId }
  | {
      readonly kind: "cx";
      readonly control: QubitId;
      readonly target: QubitId;
    }
  | {
      readonly kind: "ccx";
      readonly controls: readonly [QubitId, QubitId];
      readonly target: QubitId;
    }
  | { readonly kind: "h"; readonly target: QubitId }
  | {
      readonly kind: "cp";
      readonly control: QubitId;
      readonly target: QubitId;
      readonly angle: number;
    }
  | {
      readonly kind: "swap";
      readonly targets: readonly [QubitId, QubitId];
    };

export type QuantumGateDefinition = {
  readonly name: string;
  readonly gate: QuantumGate;
};

export type QuantumGateEmission = {
  readonly gate: QuantumGate;
  readonly primitiveName: string;
  readonly direction: HostPrimitiveContext["direction"];
};

export type QuantumGateEmitter = {
  emit(emission: QuantumGateEmission): Promise<void>;
};

const cloneGate = (gate: QuantumGate): QuantumGate => {
  switch (gate.kind) {
    case "ccx":
      return { ...gate, controls: [...gate.controls] };
    case "swap":
      return { ...gate, targets: [...gate.targets] };
    default:
      return { ...gate };
  }
};

const operands = (gate: QuantumGate): readonly QubitId[] => {
  switch (gate.kind) {
    case "x":
    case "h":
      return [gate.target];
    case "cx":
    case "cp":
      return [gate.control, gate.target];
    case "ccx":
      return [...gate.controls, gate.target];
    case "swap":
      return gate.targets;
  }
};

export const inverseGate = (gate: QuantumGate): QuantumGate =>
  gate.kind === "cp"
    ? { ...gate, angle: -gate.angle }
    : cloneGate(gate);

export const quantumGateEqual = (
  left: QuantumGate,
  right: QuantumGate,
  tolerance = 1e-12,
): boolean => {
  if (left.kind !== right.kind) return false;
  if (left.kind === "cp" && right.kind === "cp") {
    return (
      left.control === right.control &&
      left.target === right.target &&
      Math.abs(left.angle - right.angle) <= tolerance
    );
  }
  return JSON.stringify(left) === JSON.stringify(right);
};

export class QuantumGateCatalog {
  readonly #wires: ReadonlySet<QubitId>;
  readonly #entries = new Map<string, QuantumGate>();

  constructor(
    readonly wires: readonly QubitId[],
    definitions: readonly QuantumGateDefinition[],
  ) {
    this.#wires = new Set(wires);
    if (this.#wires.size !== wires.length) {
      throw new Error("Quantum wire names must be unique.");
    }
    for (const wire of wires) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(wire)) {
        throw new TypeError(`Invalid quantum wire ${JSON.stringify(wire)}.`);
      }
    }
    for (const definition of definitions) this.#register(definition);
  }

  get definitions(): readonly QuantumGateDefinition[] {
    return [...this.#entries].map(([name, gate]) => ({
      name,
      gate: cloneGate(gate),
    }));
  }

  gate(name: string): QuantumGate | undefined {
    const gate = this.#entries.get(name.toLowerCase());
    return gate === undefined ? undefined : cloneGate(gate);
  }

  createPrimitiveRegistry(emitter: QuantumGateEmitter): PrimitiveRegistry {
    const registry = new PrimitiveRegistry();
    for (const [name, registeredGate] of this.#entries) {
      registry.register(name, {
        forward: async (context) => {
          const receipt = cloneGate(registeredGate);
          await emitter.emit({
            gate: cloneGate(receipt),
            primitiveName: context.primitiveName,
            direction: context.direction,
          });
          return receipt;
        },
        backward: async (receipt: QuantumGate, context) => {
          this.#validateGate(receipt, `receipt for ${context.primitiveName}`);
          if (!quantumGateEqual(receipt, registeredGate)) {
            throw new Error(
              `Gate receipt for ${context.primitiveName} does not match the catalog.`,
            );
          }
          await emitter.emit({
            gate: inverseGate(receipt),
            primitiveName: context.primitiveName,
            direction: context.direction,
          });
        },
      });
    }
    return registry;
  }

  #register(definition: QuantumGateDefinition): void {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(definition.name)) {
      throw new TypeError(
        `Invalid quantum primitive name ${JSON.stringify(definition.name)}.`,
      );
    }
    const name = definition.name.toLowerCase();
    if (this.#entries.has(name)) {
      throw new Error(`Duplicate quantum primitive ${JSON.stringify(name)}.`);
    }
    this.#validateGate(definition.gate, name);
    this.#entries.set(name, cloneGate(definition.gate));
  }

  #validateGate(gate: QuantumGate, label: string): void {
    if (gate.kind === "cp" && !Number.isFinite(gate.angle)) {
      throw new TypeError(`Invalid phase angle for ${label}.`);
    }
    const gateOperands = operands(gate);
    for (const wire of gateOperands) {
      if (!this.#wires.has(wire)) {
        throw new Error(
          `Unknown quantum wire ${JSON.stringify(wire)} in ${label}.`,
        );
      }
    }
    if (new Set(gateOperands).size !== gateOperands.length) {
      throw new Error(`A gate cannot use the same quantum wire twice in ${label}.`);
    }
  }
}
