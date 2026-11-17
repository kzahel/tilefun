import { CHUNK_SIZE_PX, TICK_RATE } from "../config/constants.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { around } from "./InterestManager.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";

const TRAFFIC_PREFETCH_CHUNKS = 4;
const TRAFFIC_VIEW_BUFFER_CHUNKS = 1;

/** Keep ordinary road slots outside the views of players already in this realm. */
export class RealmTrafficPopulation {
  private dormant: ReadonlySet<string> = new Set();

  constructor(private readonly realm: Pick<Realm, "sessions" | "vehicleRegistry">) {}

  tick(tick: number, dormant: ReadonlySet<string>) {
    this.dormant = dormant;
    const registry = this.realm.vehicleRegistry;
    if (!registry || tick % (TICK_RATE * 2) !== 0) return;
    const viewers = this.viewers();
    const ranges = (radius: number) =>
      viewers.map(({ player: { position } }) =>
        around(
          Math.floor(position.wx / CHUNK_SIZE_PX),
          Math.floor(position.wy / CHUNK_SIZE_PX),
          radius,
        ),
      );
    registry.populate(ranges(2), {
      ranges: ranges(TRAFFIC_PREFETCH_CHUNKS),
      excluded: this.exclusions(viewers),
    });
  }

  prepareArrival(range: ChunkRange) {
    this.realm.vehicleRegistry?.populate([range], { excluded: this.exclusions(this.viewers()) });
  }

  private viewers() {
    return [...this.realm.sessions.values()].filter(
      (s) => !s.retired && !s.transitioning && !this.dormant.has(s.clientId),
    );
  }

  private exclusions(viewers: readonly PlayerSession[]): ChunkRange[] {
    const buffer = TRAFFIC_VIEW_BUFFER_CHUNKS;
    return viewers.map(({ visibleRange: view }) => ({
      minCx: view.minCx - buffer,
      maxCx: view.maxCx + buffer,
      minCy: view.minCy - buffer,
      maxCy: view.maxCy + buffer,
    }));
  }
}
