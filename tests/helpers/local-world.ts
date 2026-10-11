import type { Page } from "@playwright/test";
import type { StoredRecord } from "../../src/persistence/RecordStore.js";
import { RECORD_DATABASE_SUFFIX } from "../../src/persistence/SaveFormat.js";
import { LAST_WORLD_KEY } from "../../src/shared/storageKeys.js";

type LocalGame = {
  loop: { stop(): void };
  netEmulatedTransport: {
    base: {
      setHidden(hidden: boolean): void;
      flush(): Promise<void>;
      shutdown(): Promise<void>;
    };
  };
};

export async function flushLocalWorld(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const game = (document.querySelector("#game") as unknown as { __game: LocalGame }).__game;
    await game.netEmulatedTransport.base.flush();
  });
}

/** Navigation cannot await unload saves. Fence the authority before reopening it. */
export async function stopLocalWorld(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const game = (document.querySelector("#game") as unknown as { __game: LocalGame }).__game;
    game.loop.stop();
    const host = game.netEmulatedTransport.base;
    host.setHidden(true);
    await host.shutdown();
  });
}

/** Read committed identities, independent of replica IDs and streamed population counts. */
export async function worldRecords(page: Page): Promise<StoredRecord[]> {
  return page.evaluate(
    async ({ key, suffix }) => {
      const id = sessionStorage.getItem(key);
      if (!id) throw new Error("Missing current world");
      const name = `tilefun-world-${id}${suffix}`;
      if (!(await indexedDB.databases()).some((db) => db.name === name))
        throw new Error(`Missing saved world: ${name}`);
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        return await new Promise<StoredRecord[]>((resolve, reject) => {
          const tx = db.transaction("records", "readonly");
          const request = tx.objectStore("records").getAll();
          tx.oncomplete = () => resolve(request.result as StoredRecord[]);
          tx.onabort = () => reject(tx.error);
          tx.onerror = () => reject(tx.error);
        });
      } finally {
        db.close();
      }
    },
    { key: LAST_WORLD_KEY, suffix: RECORD_DATABASE_SUFFIX },
  );
}
