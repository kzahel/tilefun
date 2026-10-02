import { workshopFetch } from "./AuthClient.js";

const SOURCES = [
  { key: "tilefun.art-workbench.v1", api: "art-notes", array: false },
  { key: "tilefun.building-feedback.v1", api: "art-notes", array: false },
  { key: "tilefun.indoor-review.v1", api: "interior-review", array: false },
  { key: "tilefun.furniture-motion-outbox.v1", api: "interior-review", array: true },
];
function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
export function legacyPendingCount() {
  return SOURCES.reduce((n, s) => {
    const value = read(s.key);
    const rows = s.array ? value : (value as { outbox?: unknown[] } | null)?.outbox;
    return n + (Array.isArray(rows) ? rows.length : 0);
  }, 0);
}
export async function flushLegacyOutboxes() {
  for (const source of SOURCES) {
    const value = read(source.key),
      rows = source.array ? value : (value as { outbox?: unknown[] } | null)?.outbox;
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row.id !== "string") continue;
      const response = await workshopFetch(`/tilefun/api/${source.api}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      if (!response.ok)
        throw new Error((await response.json()).error ?? "Could not sync existing feedback");
      // Re-read after the request: another tab may have added a different event.
      const latest = read(source.key);
      if (source.array && Array.isArray(latest))
        localStorage.setItem(source.key, JSON.stringify(latest.filter((e) => e.id !== row.id)));
      else if (
        latest &&
        typeof latest === "object" &&
        "outbox" in latest &&
        Array.isArray(latest.outbox)
      ) {
        const next = { ...latest, outbox: latest.outbox.filter((e) => e.id !== row.id) };
        localStorage.setItem(source.key, JSON.stringify(next));
      }
    }
  }
}
