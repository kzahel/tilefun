import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { WorkshopEvent } from "./WorkshopTypes.js";

export interface ReviewQueue {
  filter: "unchecked" | "all" | "approved" | "changes";
  selected: string;
  paused: boolean;
  batch: { id: string; fingerprint: string; eventId: string; note: string }[];
}
interface WorkspaceState {
  drafts: Record<string, string>;
  queues: Record<string, ReviewQueue>;
  outbox: WorkshopEvent[];
  dismissed: string[];
  setDraft: (key: string, value: string) => void;
  setQueue: (key: string, value: ReviewQueue) => void;
  enqueue: (event: WorkshopEvent) => void;
  acknowledge: (id: string) => void;
  dismiss: (id: string) => void;
}
let storageFailed = false;
export const workshopStorageFailed = () => storageFailed;
function storageError() {
  storageFailed = true;
  if (typeof window !== "undefined") window.dispatchEvent(new Event("tilefun:storage-error"));
}
export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set) => ({
      drafts: {},
      queues: {},
      outbox: [],
      dismissed: [],
      setDraft: (key, value) => set((state) => ({ drafts: { ...state.drafts, [key]: value } })),
      setQueue: (key, value) => set((state) => ({ queues: { ...state.queues, [key]: value } })),
      enqueue: (event) =>
        set((state) => ({ outbox: [...state.outbox.filter((e) => e.id !== event.id), event] })),
      acknowledge: (id) => set((state) => ({ outbox: state.outbox.filter((e) => e.id !== id) })),
      dismiss: (id) => set((state) => ({ dismissed: [...state.dismissed, id] })),
    }),
    {
      name: "tilefun.workshop.v1",
      version: 1,
      storage: createJSONStorage(() => ({
        getItem: (key) => {
          try {
            return localStorage.getItem(key);
          } catch {
            storageError();
            return null;
          }
        },
        setItem: (key, value) => {
          try {
            localStorage.setItem(key, value);
          } catch {
            storageError();
          }
        },
        removeItem: (key) => {
          try {
            localStorage.removeItem(key);
          } catch {
            storageError();
          }
        },
      })),
      onRehydrateStorage: () => (_state, error) => {
        if (error) storageError();
      },
    },
  ),
);

export function legacyValue(key: string): Record<string, unknown> {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}
export const queueStorageKey = (batch: string) =>
  batch.startsWith("rooms-")
    ? "tilefun.indoor-review.v1"
    : batch === "roads"
      ? "tilefun.surface-review.v1"
      : batch === "districts"
        ? "tilefun.district-review.v1"
        : batch === "streets"
          ? "tilefun.street-review.v1"
          : "tilefun.building-review.v1";
export function initialQueue(batch: string): ReviewQueue {
  const value = legacyValue(queueStorageKey(batch));
  const filter = ["unchecked", "all", "approved", "changes"].includes(String(value.filter))
    ? (value.filter as ReviewQueue["filter"])
    : value.uncheckedOnly === false
      ? "all"
      : "unchecked";
  return {
    filter,
    selected:
      typeof value.selected === "string"
        ? value.selected
        : typeof value.current === "string"
          ? value.current
          : "",
    paused: !!value.paused,
    batch: Array.isArray(value.batch)
      ? value.batch.flatMap((e) =>
          e && typeof e === "object" && typeof e.fingerprint === "string"
            ? [
                {
                  id: e.key ?? e.id,
                  fingerprint: e.fingerprint,
                  eventId: e.threadId ?? "",
                  note: "Existing report",
                },
              ]
            : [],
        )
      : [],
  };
}
export function persistQueue(batch: string, q: ReviewQueue) {
  try {
    const key = queueStorageKey(batch),
      previous = legacyValue(key);
    localStorage.setItem(
      key,
      JSON.stringify({
        ...previous,
        ...(batch.startsWith("rooms-")
          ? {
              current: q.selected,
              uncheckedOnly: q.filter === "unchecked",
              batch: q.batch.map((e) => ({ id: e.id, fingerprint: e.fingerprint })),
              paused: q.paused,
            }
          : {
              selected: q.selected,
              filter: q.filter,
              paused: q.paused,
              batch: q.batch.map((e) => ({
                key: e.id,
                fingerprint: e.fingerprint,
                threadId: e.eventId,
              })),
            }),
      }),
    );
  } catch {
    /* Workshop's persisted copy remains available. */
  }
}
export function legacyDraft(key: string) {
  const drafts = legacyValue("tilefun.building-drafts.v1");
  return typeof drafts[key] === "string" ? (drafts[key] as string) : "";
}
