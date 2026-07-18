import type { Direction } from "../janus/ast";
import type { PrimitiveManifest } from "../janus/resolver";
import type { SourceSpan } from "../janus/span";

export type HostPrimitiveContext = {
  readonly sessionId: string;
  readonly primitiveName: string;
  readonly direction: Direction;
  readonly span: SourceSpan;
};

export type HostPrimitive<Receipt> = {
  forward(context: HostPrimitiveContext): Promise<Receipt>;
  backward(receipt: Receipt, context: HostPrimitiveContext): Promise<void>;
};

export type RegisteredHostPrimitive = HostPrimitive<unknown>;

const normalizeName = (name: string): string => name.toLowerCase();

export class PrimitiveRegistry {
  readonly #primitives = new Map<string, RegisteredHostPrimitive>();

  register<Receipt>(name: string, primitive: HostPrimitive<Receipt>): this {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) {
      throw new TypeError(`Invalid primitive name ${JSON.stringify(name)}`);
    }
    const normalizedName = normalizeName(name);
    if (this.#primitives.has(normalizedName)) {
      throw new Error(`Duplicate primitive ${JSON.stringify(normalizedName)}`);
    }
    this.#primitives.set(
      normalizedName,
      primitive as unknown as RegisteredHostPrimitive,
    );
    return this;
  }

  get(name: string): RegisteredHostPrimitive | undefined {
    return this.#primitives.get(normalizeName(name));
  }

  get manifests(): readonly PrimitiveManifest[] {
    return [...this.#primitives.keys()].map((name) => ({
      name,
      hasForward: true,
      hasBackward: true,
    }));
  }
}
