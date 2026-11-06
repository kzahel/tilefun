import { Link, NavLink } from "react-router";
import { reviewUnits } from "./SceneReview.js";
import { reviewToolOwnsBatch, WORKSHOP_TOOLS } from "./ToolRegistry.js";
import type { WorkshopEvent, WorkshopInbox, WorkshopSession } from "./WorkshopTypes.js";
import { useWorkspace } from "./WorkspaceStore.js";

export function WorkshopHeader({
  menu,
  session,
  onToggleMenu,
  onLogout,
}: {
  menu: boolean;
  session: WorkshopSession | undefined;
  onToggleMenu: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="workspace-header">
      <button
        type="button"
        className="menu-toggle"
        aria-label="Toggle tool navigation"
        aria-expanded={menu}
        onClick={onToggleMenu}
      >
        ☰
      </button>
      <Link className="workshop-brand" to="/">
        TILEFUN <span>Workshop</span>
      </Link>
      <div className="session-controls">
        {session?.authenticated ? (
          <>
            <span>{session.local ? "Local access" : session.owner}</span>
            {session.local ? null : (
              <button type="button" onClick={onLogout}>
                Sign out
              </button>
            )}
          </>
        ) : (
          <Link to="/login">Sign in</Link>
        )}
        <a href="/tilefun/">Play ↗</a>
      </div>
    </header>
  );
}

export function WorkshopSidebar({
  menu,
  inbox,
}: {
  menu: boolean;
  inbox: WorkshopInbox | undefined;
}) {
  return (
    <aside
      className={`workspace-sidebar ${menu ? "is-open" : ""}`}
      aria-label="Workshop navigation"
    >
      <nav>
        <p className="nav-heading">WORKSPACE</p>
        <NavLink to="/" end>
          Review inbox{" "}
          <span className="nav-count">
            {(inbox ? reviewUnits(inbox.candidates) : undefined)?.filter(
              (c) => c.state === "unchecked" || c.state === "changed",
            ).length ?? "—"}
          </span>
        </NavLink>
        <NavLink to="/requests">
          Requests & fixes <span className="nav-count">{inbox?.requests.length ?? "—"}</span>
        </NavLink>
        <NavLink to="/play-ideas">💡 Play ideas</NavLink>
        <NavLink to="/diagnostics">Game diagnostics</NavLink>
        <NavLink to="/activity">Activity & history</NavLink>
        <NavLink to="/tools">All tools</NavLink>
        <p className="nav-heading">MAKE & EXPLORE</p>
        {WORKSHOP_TOOLS.filter((tool) => tool.sidebar).map((tool) => (
          <NavLink key={tool.id} to={`/tool/${tool.id}`}>
            {tool.name}
            {tool.sidebar === "review" ? (
              <span className="nav-count">
                {(inbox ? reviewUnits(inbox.candidates) : undefined)?.filter(
                  (c) =>
                    reviewToolOwnsBatch(tool.id, c.batchId) &&
                    ["unchecked", "changed"].includes(c.state),
                ).length ?? "—"}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>
      <p className="sidebar-foot">
        One workspace.
        <br />
        Shared art, shared review.
      </p>
    </aside>
  );
}

function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Save status line plus storage and stuck-submission notices above the routed page. */
export function WorkspaceNotices({
  authenticated,
  legacyCount,
  syncMessage,
  storageWarning,
  nativeOutbox,
}: {
  authenticated: boolean | undefined;
  legacyCount: number;
  syncMessage: string;
  storageWarning: boolean;
  nativeOutbox: WorkshopEvent[];
}) {
  const pending = nativeOutbox.length + legacyCount;
  return (
    <>
      <div className="save-status" role="status" aria-live="polite">
        {pending
          ? `${pending} pending save${pending === 1 ? "" : "s"} · kept in this browser`
          : authenticated
            ? "Shared feedback connected"
            : "Browse art · sign in to review"}
        {syncMessage ? ` · ${syncMessage}` : ""}
        {syncMessage.includes("Sign in") ? <Link to="/login">Sign in to sync</Link> : null}
      </div>
      {storageWarning ? (
        <div className="notice" role="alert">
          Browser storage is unavailable or full. Keep this tab open until pending saves finish.{" "}
          <button
            type="button"
            onClick={() => downloadJson("tilefun-workshop-backup.json", useWorkspace.getState())}
          >
            Export drafts and pending feedback
          </button>
        </div>
      ) : null}
      {nativeOutbox.length > 0 && syncMessage && !syncMessage.includes("Sign in") ? (
        <details className="notice">
          <summary>Pending submissions</summary>
          <p>
            These submissions are retained. Export them before discarding an event that cannot be
            saved.
          </p>
          <button
            type="button"
            onClick={() => downloadJson("tilefun-workshop-outbox.json", nativeOutbox)}
          >
            Export pending feedback
          </button>
          {nativeOutbox.map((e) => (
            <p key={e.id}>
              {e.type} · {e.id}{" "}
              <button type="button" onClick={() => useWorkspace.getState().acknowledge(e.id)}>
                Discard this pending event
              </button>
            </p>
          ))}
        </details>
      ) : null}
    </>
  );
}
