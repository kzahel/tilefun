import type { QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { workshopJson } from "./AuthClient.js";
import { flushLegacyOutboxes, legacyPendingCount } from "./LegacyOutboxes.js";
import { useWorkspace } from "./WorkspaceStore.js";

/** Post queued native events in order, retiring each only after the shared view refreshes. */
async function flushNativeOutbox(queryClient: QueryClient): Promise<void> {
  for (const event of useWorkspace.getState().outbox) {
    await workshopJson("workshop/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    // Refresh before retiring the local optimistic judgment.
    await queryClient.invalidateQueries({ queryKey: ["workshop"] });
    useWorkspace.getState().acknowledge(event.id);
  }
}

/**
 * Keep native and legacy outboxes flowing to the server: on mount, every five
 * seconds, when the browser comes online, on cross-tab storage changes and
 * whenever the native outbox changes.
 */
export function useOutboxSync(authenticated: boolean | undefined, queryClient: QueryClient) {
  const [syncMessage, setSyncMessage] = useState(""),
    [legacyCount, setLegacyCount] = useState(0);
  useEffect(() => {
    let active = true,
      running = false;
    const sync = async () => {
      if (running) return;
      running = true;
      try {
        if (active) setLegacyCount(legacyPendingCount());
        if (!authenticated) return;
        await flushNativeOutbox(queryClient);
        await flushLegacyOutboxes();
        if (active) {
          setLegacyCount(legacyPendingCount());
          setSyncMessage("");
        }
      } catch (error) {
        if (active) setSyncMessage(error instanceof Error ? error.message : "Could not sync");
      } finally {
        running = false;
      }
    };
    void sync();
    const interval = setInterval(() => void sync(), 5000),
      changed = () => void sync();
    window.addEventListener("online", changed);
    window.addEventListener("storage", changed);
    const unsubscribe = useWorkspace.subscribe((state, previous) => {
      if (state.outbox !== previous.outbox) void sync();
    });
    return () => {
      active = false;
      clearInterval(interval);
      unsubscribe();
      window.removeEventListener("online", changed);
      window.removeEventListener("storage", changed);
    };
  }, [authenticated, queryClient]);
  return { syncMessage, setSyncMessage, legacyCount };
}
