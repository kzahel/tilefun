import { CVar, type CVarCategory, type CVarDesc } from "./CVar.js";

export class CVarRegistry {
  private cvars = new Map<string, CVar>();

  register<T extends number | boolean | string>(desc: CVarDesc<T>): CVar<T> {
    if (this.cvars.has(desc.name)) {
      throw new Error(`[cvar] duplicate registration: ${desc.name}`);
    }
    const cv = new CVar(desc);
    // biome-ignore lint/suspicious/noExplicitAny: generic CVar<T> stored as CVar in map
    this.cvars.set(desc.name, cv as any);
    return cv;
  }

  get(name: string): CVar | undefined {
    return this.cvars.get(name);
  }

  getAll(): CVar[] {
    return [...this.cvars.values()];
  }

  getByCategory(category: CVarCategory): CVar[] {
    return this.getAll().filter((cv) => cv.category === category);
  }

  getNames(): string[] {
    return [...this.cvars.keys()];
  }

  resetAll(): void {
    for (const cv of this.cvars.values()) cv.reset();
  }
}
