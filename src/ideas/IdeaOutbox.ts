import type { PlayIdeaSubmission } from "./PlayIdea.js";

const DATABASE = "tilefun-play-ideas-v1";
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("ideas", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Idea storage is busy. Close other game tabs and retry."));
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("ideas", mode);
    const request = operation(tx.objectStore("ideas"));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Cannot save ideas on this device."));
    };
  });
}
export const pendingIdeas = () => transaction<PlayIdeaSubmission[]>("readonly", (s) => s.getAll());
export async function queueIdea(idea: PlayIdeaSubmission) {
  if ((await pendingIdeas()).length >= 8)
    throw new Error("Eight ideas are waiting to send. Connect and retry first.");
  await transaction("readwrite", (s) => s.put(idea));
}
export async function uploadIdea(idea: PlayIdeaSubmission) {
  const response = await fetch(`${import.meta.env.BASE_URL}api/play-ideas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(idea),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not send yet. Your idea is saved on this device.");
  }
  const result = await response.json();
  if (result.saved !== true || result.id !== idea.id)
    throw new Error("Could not confirm delivery. Your idea is saved on this device.");
}
let flushing: Promise<number> | undefined;
export function flushIdeas(): Promise<number> {
  flushing ??= (async () => {
    let sent = 0;
    for (const idea of await pendingIdeas()) {
      await uploadIdea(idea);
      await transaction("readwrite", (s) => s.delete(idea.id));
      sent++;
    }
    return sent;
  })().finally(() => {
    flushing = undefined;
  });
  return flushing;
}
