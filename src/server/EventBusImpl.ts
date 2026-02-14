import type { EventBus, Unsubscribe } from "./WorldAPI.js";

export class EventBusImpl implements EventBus {
  private listeners = new Map<string, Set<(data?: unknown) => void>>();

  emit(event: string, data?: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      try {
        cb(data);
      } catch (err) {
        console.error(`[EventBus] Error in "${event}" handler:`, err);
      }
    }
  }

  on(event: string, cb: (data?: unknown) => void): Unsubscribe {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(cb);
    return () => {
      set.delete(cb);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  once(event: string, cb: (data?: unknown) => void): Unsubscribe {
    const unsub = this.on(event, (data) => {
      unsub();
      cb(data);
    });
    return unsub;
  }

  /** Remove all listeners. Called on world reload. */
  clear(): void {
    this.listeners.clear();
  }
}
