import type { Prop } from "./Prop.js";

/** Simple store for static props. No update loop — props don't tick. */
export class PropManager {
  readonly props: Prop[] = [];
  private nextId = 1;

  getNextId(): number {
    return this.nextId;
  }

  setNextId(n: number): void {
    this.nextId = n;
  }

  add(prop: Prop): Prop {
    prop.id = this.nextId++;
    this.props.push(prop);
    return prop;
  }

  remove(id: number): boolean {
    const idx = this.props.findIndex((p) => p.id === id);
    if (idx < 0) return false;
    this.props.splice(idx, 1);
    return true;
  }
}
