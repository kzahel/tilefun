import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { workshopJson } from "./AuthClient.js";
import { WorkshopHeader, WorkshopSidebar, WorkspaceNotices } from "./WorkshopChrome.js";
import { useInbox, useSession } from "./WorkshopQueries.js";
import { WorkshopRoutes } from "./WorkshopRoutes.js";
import { useOutboxSync } from "./WorkshopSync.js";
import { useWorkspace, workshopStorageFailed } from "./WorkspaceStore.js";

/** Workshop shell: header, navigation, save status and the routed page. */
export function App() {
  const session = useSession(),
    inbox = useInbox(),
    queryClient = useQueryClient(),
    nativeOutbox = useWorkspace((s) => s.outbox);
  const [menu, setMenu] = useState(false),
    [storageWarning, setStorageWarning] = useState(workshopStorageFailed);
  const location = useLocation();
  useEffect(() => {
    if (location.pathname) setMenu(false);
  }, [location.pathname]);
  useEffect(() => {
    const failed = () => setStorageWarning(true);
    window.addEventListener("tilefun:storage-error", failed);
    return () => window.removeEventListener("tilefun:storage-error", failed);
  }, []);
  useEffect(() => {
    const expired = () => void queryClient.invalidateQueries({ queryKey: ["session"] });
    window.addEventListener("tilefun:sign-in", expired);
    return () => window.removeEventListener("tilefun:sign-in", expired);
  }, [queryClient]);
  const { syncMessage, setSyncMessage, legacyCount } = useOutboxSync(
    session.data?.authenticated,
    queryClient,
  );
  const logout = async () => {
    try {
      await workshopJson("auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      queryClient.removeQueries({ queryKey: ["workshop"] });
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <div className="workspace">
      <WorkshopHeader
        menu={menu}
        session={session.data}
        onToggleMenu={() => setMenu(!menu)}
        onLogout={() => void logout()}
      />
      <WorkshopSidebar menu={menu} inbox={inbox.data} />
      <main className="workspace-main" id="workspace-main">
        <WorkspaceNotices
          authenticated={session.data?.authenticated}
          legacyCount={legacyCount}
          syncMessage={syncMessage}
          storageWarning={storageWarning}
          nativeOutbox={nativeOutbox}
        />
        <WorkshopRoutes />
      </main>
    </div>
  );
}
