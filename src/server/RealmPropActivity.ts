import type { Prop } from "../entities/Prop.js";
import type { PropManager } from "../entities/PropManager.js";
import { actorScope } from "../persistence/ActorRecords.js";
import type { RealmStreaming } from "./RealmStreaming.js";

interface Entry {
  prop: Prop;
  wx: number;
  wy: number;
  width: number | undefined;
  height: number | undefined;
}

/** Cache static scenery admission; collisions and gameplay still use live props. */
export class RealmPropActivity {
  private manager: PropManager | undefined;
  private streaming: RealmStreaming | undefined;
  private active = new Set<string>();
  private ready = new Set<string>();
  private entries: Entry[] = [];
  private selected: Prop[] = [];
  private readonly removed = () => this.clear();

  clear(): void {
    this.manager?.removalListeners.delete(this.removed);
    this.manager = undefined;
    this.streaming = undefined;
    this.active.clear();
    this.ready.clear();
    this.entries = [];
    this.selected = [];
  }

  select(manager: PropManager, streaming: RealmStreaming): readonly Prop[] {
    let changed = this.manager !== manager || this.streaming !== streaming;
    let count = 0;
    for (const [key, demand] of streaming.demand) {
      if (!demand.activity) continue;
      count++;
      if (!this.active.has(key)) changed = true;
    }
    if (count !== this.active.size) changed = true;
    count = 0;
    // Support can depend on ready halo chunks with no activity demand.
    for (const [key, holder] of streaming.residency.holders) {
      if (holder.state !== "ready") continue;
      count++;
      if (!this.ready.has(key)) changed = true;
    }
    if (count !== this.ready.size) changed = true;
    const props = manager.props;
    if (props.length !== this.entries.length) changed = true;
    // Scalar comparisons catch replacement and in-place position/collider edits,
    // including procedural props that do not have durable mutation observers.
    for (let i = 0; i < props.length && !changed; i++) {
      const prop = props[i];
      const old = this.entries[i];
      if (
        !prop ||
        !old ||
        old.prop !== prop ||
        old.wx !== prop.position.wx ||
        old.wy !== prop.position.wy ||
        old.width !== prop.collider?.width ||
        old.height !== prop.collider?.height
      )
        changed = true;
    }
    if (!changed) return this.selected;
    this.clear();
    this.manager = manager;
    this.streaming = streaming;
    manager.removalListeners.add(this.removed);
    for (const [key, demand] of streaming.demand) if (demand.activity) this.active.add(key);
    for (const [key, holder] of streaming.residency.holders)
      if (holder.state === "ready") this.ready.add(key);
    for (const prop of props) {
      this.entries.push({
        prop,
        wx: prop.position.wx,
        wy: prop.position.wy,
        width: prop.collider?.width,
        height: prop.collider?.height,
      });
      if (this.active.has(actorScope(prop.position)) && streaming.supported(prop))
        this.selected.push(prop);
    }
    return this.selected;
  }
}
