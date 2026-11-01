import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";

/** Explicit whole-scene physics owner for experimental temporary Realms. */
export interface RealmSimulationOwner {
  step(dt: number, sessions: readonly PlayerSession[], realm: Realm): void;
  dispose(): void;
}
