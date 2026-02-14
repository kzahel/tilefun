import { generateUUID } from "../shared/uuid.js";

export interface PlayerProfile {
  id: string;
  name: string;
  pin: string | null;
  createdAt: number;
}

const PROFILE_DB = "tilefun-profiles";
const PROFILE_VERSION = 1;
const STORE_PROFILES = "profiles";

/**
 * Client-side IndexedDB store for player profiles.
 * Profiles are local to the browser (not synced to server).
 */
export class PlayerProfileStore {
  private db: IDBDatabase | null = null;

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(PROFILE_DB, PROFILE_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_PROFILES)) {
          db.createObjectStore(STORE_PROFILES, { keyPath: "id" });
        }
      };
      req.onsuccess = () => {
        this.db = req.result;
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async listProfiles(): Promise<PlayerProfile[]> {
    const db = this.db;
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROFILES, "readonly");
      const req = tx.objectStore(STORE_PROFILES).getAll();
      req.onsuccess = () => {
        const profiles = req.result as PlayerProfile[];
        profiles.sort((a, b) => a.createdAt - b.createdAt);
        resolve(profiles);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getProfile(id: string): Promise<PlayerProfile | undefined> {
    const db = this.db;
    if (!db) return undefined;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROFILES, "readonly");
      const req = tx.objectStore(STORE_PROFILES).get(id);
      req.onsuccess = () => resolve(req.result as PlayerProfile | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async createProfile(name: string): Promise<PlayerProfile> {
    const db = this.db;
    if (!db) throw new Error("Profile store not open");
    const profile: PlayerProfile = {
      id: generateUUID(),
      name,
      pin: null,
      createdAt: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROFILES, "readwrite");
      tx.objectStore(STORE_PROFILES).put(profile);
      tx.oncomplete = () => resolve(profile);
      tx.onerror = () => reject(tx.error);
    });
  }

  async updateProfile(
    id: string,
    updates: Partial<Pick<PlayerProfile, "name" | "pin">>,
  ): Promise<void> {
    const db = this.db;
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROFILES, "readwrite");
      const store = tx.objectStore(STORE_PROFILES);
      const req = store.get(id);
      req.onsuccess = () => {
        const profile = req.result as PlayerProfile | undefined;
        if (profile) {
          if (updates.name !== undefined) profile.name = updates.name;
          if (updates.pin !== undefined) profile.pin = updates.pin;
          store.put(profile);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteProfile(id: string): Promise<void> {
    const db = this.db;
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROFILES, "readwrite");
      tx.objectStore(STORE_PROFILES).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
