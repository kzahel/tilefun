export type CVarType = "number" | "boolean" | "string";
export type CVarCategory = "cl" | "sv" | "r" | "fun";

export interface CVarDesc<T = number | boolean | string> {
  name: string;
  description: string;
  type: CVarType;
  defaultValue: T;
  min?: number;
  max?: number;
  category: CVarCategory;
}

export class CVar<T = number | boolean | string> {
  readonly name: string;
  readonly description: string;
  readonly type: CVarType;
  readonly defaultValue: T;
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly category: CVarCategory;
  private value: T;
  private listeners = new Set<(newVal: T, oldVal: T) => void>();

  constructor(desc: CVarDesc<T>) {
    this.name = desc.name;
    this.description = desc.description;
    this.type = desc.type;
    this.defaultValue = desc.defaultValue;
    this.min = desc.min;
    this.max = desc.max;
    this.category = desc.category;
    this.value = desc.defaultValue;
  }

  get(): T {
    return this.value;
  }

  set(raw: T): void {
    let v = raw;
    if (this.type === "number" && typeof v === "number") {
      if (this.min != null) v = Math.max(this.min, v as number) as T;
      if (this.max != null) v = Math.min(this.max, v as number) as T;
    }
    if (v === this.value) return;
    const old = this.value;
    this.value = v;
    for (const cb of this.listeners) {
      try {
        cb(v, old);
      } catch (e) {
        console.error(`[cvar] onChange error for ${this.name}:`, e);
      }
    }
  }

  reset(): void {
    this.set(this.defaultValue);
  }

  onChange(cb: (newVal: T, oldVal: T) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Parse a string value into the correct type and set it. */
  setFromString(str: string): void {
    switch (this.type) {
      case "number": {
        const n = Number(str);
        if (!Number.isNaN(n)) this.set(n as T);
        break;
      }
      case "boolean": {
        const b = str === "1" || str === "true";
        this.set(b as T);
        break;
      }
      case "string":
        this.set(str as T);
        break;
    }
  }

  toString(): string {
    return `${this.name} = ${String(this.value)} (default: ${String(this.defaultValue)}) -- ${this.description}`;
  }
}
