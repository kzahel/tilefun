import type { TickService, Unsubscribe } from "./WorldAPI.js";

export class TickServiceImpl implements TickService {
  private preCallbacks = new Set<(dt: number) => void>();
  private postCallbacks = new Set<(dt: number) => void>();

  onPreSimulation(cb: (dt: number) => void): Unsubscribe {
    this.preCallbacks.add(cb);
    return () => {
      this.preCallbacks.delete(cb);
    };
  }

  onPostSimulation(cb: (dt: number) => void): Unsubscribe {
    this.postCallbacks.add(cb);
    return () => {
      this.postCallbacks.delete(cb);
    };
  }

  firePre(dt: number): void {
    for (const cb of this.preCallbacks) {
      try {
        cb(dt);
      } catch (err) {
        console.error("[TickService] Error in preSimulation handler:", err);
      }
    }
  }

  firePost(dt: number): void {
    for (const cb of this.postCallbacks) {
      try {
        cb(dt);
      } catch (err) {
        console.error("[TickService] Error in postSimulation handler:", err);
      }
    }
  }

  /** Remove all callbacks. Called on world reload. */
  clear(): void {
    this.preCallbacks.clear();
    this.postCallbacks.clear();
  }
}
