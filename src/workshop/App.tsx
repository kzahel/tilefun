import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Component, lazy, type ReactNode, Suspense, useEffect, useRef, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";
import { isCityReviewRun } from "../art/CityReviewRuns.js";
import { workshopJson } from "./AuthClient.js";
import { flushLegacyOutboxes, legacyPendingCount } from "./LegacyOutboxes.js";
import { primaryScene, reviewUnits, scenePath } from "./SceneReview.js";
import { reviewToolOwnsBatch, WORKSHOP_TOOLS } from "./ToolRegistry.js";
import { useInbox, useManifest, useSession } from "./WorkshopQueries.js";
import type {
  CandidateSummary,
  WorkshopActivity,
  WorkshopManifest,
  WorkshopSession,
  WorkshopThread,
} from "./WorkshopTypes.js";
import { useWorkspace, workshopStorageFailed } from "./WorkspaceStore.js";

const PlayIdeasPage = lazy(() => import("./PlayIdeasPage.js"));
const ReviewPage = lazy(() => import("./ReviewPage.js"));
const CharactersPage = lazy(() => import("./CharactersPage.js"));
const TrafficPage = lazy(() => import("./TrafficPage.js"));
const VehiclesPage = lazy(() => import("./VehiclesPage.js"));
const SourcePage = lazy(() => import("./SourcePage.js"));
const PatternPage = lazy(() => import("./PatternPage.js"));
const OutdoorPage = lazy(() => import("./OutdoorPage.js"));
const ScenePage = lazy(() => import("./ScenePage.js"));
export const reviewPath = (id: string) => `/review/${encodeURIComponent(id)}`;
export const threadPath = (id: string) => `/thread/${encodeURIComponent(id)}`;
export function candidateLabel(c: CandidateSummary) {
  return c.state === "changes"
    ? "Needs changes"
    : c.state === "changed"
      ? "Changed · review again"
      : c.state === "approved"
        ? "Approved"
        : c.state === "excluded"
          ? "Compiler exclusion"
          : "Unchecked";
}
export function ErrorMessage({ error }: { error: unknown }) {
  return error ? (
    <p className="notice error" role="alert">
      {error instanceof Error ? error.message : String(error)}
    </p>
  ) : null;
}
export function AuthGate({ children }: { children: ReactNode }) {
  const session = useSession(),
    location = useLocation();
  if (session.isPending) return <p role="status">Checking login…</p>;
  if (session.error) return <ErrorMessage error={session.error} />;
  if (!session.data?.authenticated)
    return (
      <section className="empty">
        <p className="eyebrow">PRIVATE WORKSPACE</p>
        <h1>Sign in to your Workshop.</h1>
        <p>
          Your reviews and notes are shared across tools. Drafts and pending saves stay in this
          browser.
        </p>
        <Link
          className="button"
          to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
        >
          Sign in
        </Link>
      </section>
    );
  return children;
}
class WorkspaceBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <section className="empty">
        <h1>This view could not load.</h1>
        <p>{this.state.error}</p>
        <button type="button" onClick={() => location.reload()}>
          Reload Workshop
        </button>
      </section>
    ) : (
      this.props.children
    );
  }
}

export function App() {
  const session = useSession(),
    inbox = useInbox(),
    queryClient = useQueryClient(),
    nativeOutbox = useWorkspace((s) => s.outbox);
  const [syncMessage, setSyncMessage] = useState(""),
    [legacyCount, setLegacyCount] = useState(0),
    [menu, setMenu] = useState(false),
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
  useEffect(() => {
    let active = true,
      running = false;
    const sync = async () => {
      if (running) return;
      running = true;
      try {
        if (active) setLegacyCount(legacyPendingCount());
        if (!session.data?.authenticated) return;
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
  }, [session.data?.authenticated, queryClient]);
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
  const pending = nativeOutbox.length + legacyCount;
  return (
    <div className="workspace">
      <header className="workspace-header">
        <button
          type="button"
          className="menu-toggle"
          aria-label="Toggle tool navigation"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          ☰
        </button>
        <Link className="workshop-brand" to="/">
          TILEFUN <span>Workshop</span>
        </Link>
        <div className="session-controls">
          {session.data?.authenticated ? (
            <>
              <span>{session.data.local ? "Local access" : session.data.owner}</span>
              {session.data.local ? null : (
                <button type="button" onClick={() => void logout()}>
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
      <aside
        className={`workspace-sidebar ${menu ? "is-open" : ""}`}
        aria-label="Workshop navigation"
      >
        <nav>
          <p className="nav-heading">WORKSPACE</p>
          <NavLink to="/" end>
            Review inbox{" "}
            <span className="nav-count">
              {(inbox.data ? reviewUnits(inbox.data.candidates) : undefined)?.filter(
                (c) => c.state === "unchecked" || c.state === "changed",
              ).length ?? "—"}
            </span>
          </NavLink>
          <NavLink to="/requests">
            Requests & fixes <span className="nav-count">{inbox.data?.requests.length ?? "—"}</span>
          </NavLink>
          <NavLink to="/play-ideas">💡 Play ideas</NavLink>
          <NavLink to="/activity">Activity & history</NavLink>
          <NavLink to="/tools">All tools</NavLink>
          <p className="nav-heading">MAKE & EXPLORE</p>
          {WORKSHOP_TOOLS.filter((tool) =>
            [
              "patterns",
              "outdoor",
              "traffic",
              "vehicles",
              "character-lab",
              "art",
              "buildings",
              "roads",
              "districts",
              "streets",
              "rooms",
              "motion",
              "indoor",
              "explorer",
              "autotiles",
            ].includes(tool.id),
          ).map((tool) => (
            <NavLink key={tool.id} to={`/tool/${tool.id}`}>
              {tool.name}
              {(["review", "adapter"].includes(tool.mode) || tool.id === "patterns") &&
              [
                "patterns",
                "traffic",
                "vehicles",
                "character-lab",
                "buildings",
                "roads",
                "districts",
                "streets",
                "rooms",
                "motion",
              ].includes(tool.id) ? (
                <span className="nav-count">
                  {(inbox.data ? reviewUnits(inbox.data.candidates) : undefined)?.filter(
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
      <main className="workspace-main" id="workspace-main">
        <div className="save-status" role="status" aria-live="polite">
          {pending
            ? `${pending} pending save${pending === 1 ? "" : "s"} · kept in this browser`
            : session.data?.authenticated
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
        {nativeOutbox.length && syncMessage && !syncMessage.includes("Sign in") ? (
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
        <WorkspaceBoundary key={location.pathname.split("/")[1]}>
          <Suspense fallback={<p role="status">Loading tool…</p>}>
            <Routes>
              <Route
                path="/"
                element={
                  <AuthGate>
                    <InboxPage />
                  </AuthGate>
                }
              />
              <Route
                path="/play-ideas"
                element={
                  <AuthGate>
                    <PlayIdeasPage />
                  </AuthGate>
                }
              />
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/requests"
                element={
                  <AuthGate>
                    <RequestsPage />
                  </AuthGate>
                }
              />
              <Route
                path="/activity"
                element={
                  <AuthGate>
                    <ActivityPage />
                  </AuthGate>
                }
              />
              <Route
                path="/thread/:id"
                element={
                  <AuthGate>
                    <ThreadPage />
                  </AuthGate>
                }
              />
              <Route path="/tools" element={<ToolsPage />} />
              <Route path="/tool/:tool" element={<ToolPage />} />
              <Route
                path="/scene/:id"
                element={
                  <AuthGate>
                    <ScenePage />
                  </AuthGate>
                }
              />
              <Route
                path="/review/:id"
                element={
                  <AuthGate>
                    <ReviewPage />
                  </AuthGate>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </WorkspaceBoundary>
      </main>
    </div>
  );
}
export function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function LoginPage() {
  const session = useSession(),
    navigate = useNavigate(),
    location = useLocation(),
    queryClient = useQueryClient();
  const [username, setUsername] = useState("owner"),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const rawReturn = new URLSearchParams(location.search).get("returnTo") ?? "/",
    returnTo = rawReturn.startsWith("/") && !rawReturn.startsWith("//") ? rawReturn : "/";
  if (session.data?.authenticated)
    return (
      <section className="empty">
        <h1>You’re signed in.</h1>
        <Link className="button" to={returnTo}>
          Return to Workshop
        </Link>
      </section>
    );
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/tilefun/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Login failed");
      queryClient.setQueryData<WorkshopSession>(["session"], value);
      setPassword("");
      navigate(returnTo, { replace: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="login-card">
      <p className="eyebrow">TILEFUN WORKSHOP</p>
      <h1>Your art desk, together.</h1>
      <p>Sign in to see review progress, annotate source art and share feedback.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label>
          Username
          <input
            aria-label="Username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            aria-label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="primary"
          disabled={busy || session.data?.configured === false}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <ErrorMessage error={error} />
      {session.data?.configured === false ? (
        <p className="notice">
          Owner login hasn’t been configured on this server. Run{" "}
          <code>npm run workshop:auth -- setup</code> there.
        </p>
      ) : null}
      <Link to="/tools">Browse public tools →</Link>
    </section>
  );
}
function InboxPage() {
  const inbox = useInbox(),
    manifest = useManifest(),
    [filter, setFilter] = useState("pending"),
    [area, setArea] = useState("all");
  if (inbox.isPending || manifest.isPending) return <p role="status">Loading review batches…</p>;
  if (!inbox.data || !manifest.data) return <ErrorMessage error={inbox.error ?? manifest.error} />;
  const candidates = reviewUnits(inbox.data.candidates),
    batches = manifest.data.batches.filter(
      (b) =>
        area === "all" ||
        (area === "city"
          ? !["rooms", "motion"].includes(b.toolId)
          : ["rooms", "motion"].includes(b.toolId)),
    );
  const pending = candidates.filter((c) => ["unchecked", "changed"].includes(c.state)).length,
    approved = candidates.filter((c) => c.state === "approved").length,
    changes = candidates.filter((c) => c.state === "changes").length;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR REVIEW DESK</p>
          <h1>What’s ready to look at?</h1>
          <p>Every available batch is here, including work you haven’t opened yet.</p>
        </div>
        <button
          type="button"
          onClick={() => void Promise.all([inbox.refetch(), manifest.refetch()])}
        >
          Refresh
        </button>
      </div>
      <div className="summary-strip">
        <div>
          <strong>{pending}</strong>
          <span>to review</span>
        </div>
        <div>
          <strong>{changes}</strong>
          <span>need changes</span>
        </div>
        <div>
          <strong>{approved}</strong>
          <span>approved</span>
        </div>
        <Link to="/requests">
          <strong>{inbox.data.requests.length}</strong>
          <span>requests & fixes</span>
        </Link>
      </div>
      {!inbox.data.manifestCurrent ? (
        <p className="notice error">
          Candidate inputs changed since the last manifest render. Review is paused until the
          current manifest is generated; stale approvals are not counted.
        </p>
      ) : null}
      <div className="filter-row">
        <label>
          Show
          <select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="pending">Ready for review</option>
            <option value="changes">Needs changes</option>
            <option value="all">All batches</option>
            <option value="approved">Approved batches</option>
          </select>
        </label>
        <label>
          Area
          <select aria-label="Area" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="all">Everything</option>
            <option value="city">City & exterior</option>
            <option value="interiors">Rooms & furniture</option>
          </select>
        </label>
        <span>
          {manifest.data.tools.length} tools · {manifest.data.batches.length} batches
        </span>
      </div>
      <div className="batch-grid">
        {batches.map((batch) => {
          const rows = candidates.filter((c) => c.batchId === batch.id),
            pending = rows.filter((c) => ["unchecked", "changed"].includes(c.state)),
            changes = rows.filter((c) => c.state === "changes"),
            approved = rows.filter((c) => c.state === "approved");
          if (
            (filter === "pending" && !pending.length) ||
            (filter === "changes" && !changes.length) ||
            (filter === "approved" && !approved.length)
          )
            return null;
          const first =
            (filter === "changes" ? changes[0] : pending[0]) ?? rows.find((c) => !c.excluded);
          return (
            <article className="batch-card" key={batch.id} data-batch={batch.id}>
              <div className="card-top">
                <span className="tag">
                  {WORKSHOP_TOOLS.find((t) => t.id === batch.toolId)?.name}
                </span>
                <span>
                  {rows.filter((c) => !c.excluded).length}{" "}
                  {rows.some(primaryScene) ? "neighborhood" : "cases"}
                </span>
              </div>
              <h2>{batch.name}</h2>
              <p>{batch.description}</p>
              <div className="batch-counts">
                <span>
                  {pending.length} unchecked
                  {pending.some((c) => c.state === "changed")
                    ? ` · ${pending.filter((c) => c.state === "changed").length} changed`
                    : ""}
                </span>
                <span>{approved.length} approved</span>
                {changes.length ? (
                  <span className="needs-changes">{changes.length} need changes</span>
                ) : null}
              </div>
              {first ? (
                <Link
                  className="button"
                  to={
                    first.kind === "motion"
                      ? `/tool/motion?${new URL(first.url, location.origin).searchParams}`
                      : scenePath(first) +
                        (!pending.length && filter !== "changes" ? "?show=all" : "")
                  }
                >
                  {pending.length ? "Continue review" : "Inspect batch"} →
                </Link>
              ) : (
                <span>No reviewable cases</span>
              )}
            </article>
          );
        })}
      </div>
      {!batches.some((b) =>
        candidates.some(
          (c) =>
            c.batchId === b.id &&
            (filter === "all" ||
              (filter === "pending" && ["unchecked", "changed"].includes(c.state)) ||
              (filter === "changes" && c.state === "changes") ||
              (filter === "approved" && c.state === "approved")),
        ),
      ) ? (
        <section className="empty">
          <h2>Nothing in this view.</h2>
          <button type="button" onClick={() => setFilter("all")}>
            Show all batches
          </button>
        </section>
      ) : null}
    </>
  );
}
function RequestsPage() {
  const inbox = useInbox();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">COMMENTS → FIXES</p>
          <h1>Requests & fixes</h1>
          <p>Source-art ideas and reported problems, with their current status.</p>
        </div>
      </div>
      <ErrorMessage error={inbox.error} />
      {inbox.isPending ? (
        <p>Loading requests…</p>
      ) : inbox.data?.requests.length ? (
        <div className="thread-list">
          {inbox.data.requests.map((t) => (
            <ThreadCard key={t.id} thread={t} />
          ))}
        </div>
      ) : (
        <section className="empty">
          <h2>No outstanding requests.</h2>
          <Link to="/activity">Browse history →</Link>
        </section>
      )}
    </>
  );
}
function ThreadCard({ thread }: { thread: WorkshopThread }) {
  return (
    <article className="thread-card">
      <div className="card-top">
        <span className="tag">{thread.kind === "art" ? "Art / city" : "Interior / furniture"}</span>
        <span>{thread.status}</span>
      </div>
      <h2>
        <Link to={threadPath(thread.id)}>{thread.name}</Link>
      </h2>
      <p className="user-text">{thread.note}</p>
      {thread.reply ? <blockquote className="user-text">{thread.reply}</blockquote> : null}
      <div className="card-links">
        <Link to={threadPath(thread.id)}>Open thread & reply →</Link>
        <LegacyLink url={thread.url}>Inspect context ↗</LegacyLink>
      </div>
      <time dateTime={thread.createdAt}>{new Date(thread.createdAt).toLocaleString()}</time>
    </article>
  );
}
function ActivityPage() {
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ["workshop", "activity", offset],
    queryFn: () =>
      workshopJson<{ events: WorkshopActivity[]; total: number; next: number | null }>(
        `workshop/activity?offset=${offset}&limit=50`,
      ),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SHARED HISTORY</p>
          <h1>Activity</h1>
          <p>Approvals, reports, replies and fixes from every shared review tool.</p>
        </div>
      </div>
      <ErrorMessage error={query.error} />
      <div className="activity-list">
        {query.data?.events.map((e) => (
          <article key={e.eventId}>
            <span
              className={`tag ${e.verdict === "changes" || e.verdict === "wrong" ? "needs-changes" : ""}`}
            >
              {e.verdict ?? e.status}
            </span>
            <Link to={threadPath(e.id)}>{e.name}</Link>
            <p className="user-text">{e.reply || e.note}</p>
            <time>{new Date(e.createdAt).toLocaleString()}</time>
          </article>
        ))}
      </div>
      <div className="filter-row">
        <button
          type="button"
          disabled={!offset}
          onClick={() => setOffset(Math.max(0, offset - 50))}
        >
          ← Newer
        </button>
        <span>
          {query.data
            ? `${offset + 1}–${Math.min(offset + 50, query.data.total)} of ${query.data.total}`
            : "Loading…"}
        </span>
        <button
          type="button"
          disabled={query.data?.next == null}
          onClick={() => setOffset(query.data?.next ?? offset)}
        >
          Older →
        </button>
      </div>
    </>
  );
}
function ThreadPage() {
  const { id = "" } = useParams(),
    query = useQuery({
      queryKey: ["workshop", "thread", id],
      queryFn: () =>
        workshopJson<{
          thread: WorkshopThread;
          history: {
            id: string;
            createdAt: string;
            note: string;
            reply?: string;
            status?: string;
            verdict?: string;
            screenshot?: string;
          }[];
          discussion: {
            id: string;
            reply: string;
            status: string;
            createdAt: string;
            author: string;
          }[];
        }>(`workshop/threads/${encodeURIComponent(id)}`),
    });
  const draftKey = `reply:${id}`,
    draft = useWorkspace((s) => s.drafts[draftKey] ?? ""),
    [status, setStatus] = useState("in-progress"),
    [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (query.data) setStatus(query.data.thread.status);
  }, [query.data]);
  if (!query.data) return <ErrorMessage error={query.error} />;
  const { thread, history, discussion } = query.data;
  return (
    <>
      <Link className="back-link" to="/requests">
        ← Requests & fixes
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{thread.kind} THREAD</p>
          <h1>{thread.name}</h1>
          <p>{thread.status}</p>
        </div>
        <LegacyLink className="button" url={thread.url}>
          Inspect original context ↗
        </LegacyLink>
      </div>
      <div className="thread-history">
        {history.map((e, i) => (
          <article key={e.id}>
            <div className="card-top">
              <strong>{i === 0 ? "Original feedback" : "History event"}</strong>
              <time>{new Date(e.createdAt).toLocaleString()}</time>
            </div>
            <p className="user-text">{e.note}</p>
            {e.reply ? <blockquote className="user-text">{e.reply}</blockquote> : null}
            <span className="tag">{e.status ?? e.verdict}</span>
            {e.screenshot ? (
              <details>
                <summary>Attached screenshot</summary>
                <img
                  className="history-screenshot"
                  src={e.screenshot}
                  alt="Screenshot attached to this report"
                />
              </details>
            ) : null}
          </article>
        ))}
      </div>
      {thread.kind === "interior"
        ? discussion.map((e) => (
            <article className="thread-card" key={e.id}>
              <strong>
                {e.author} · {e.status}
              </strong>
              <p className="user-text">{e.reply}</p>
              <time>{new Date(e.createdAt).toLocaleString()}</time>
            </article>
          ))
        : null}
      <form
        className="reply-form"
        onSubmit={(e) => {
          e.preventDefault();
          useWorkspace.getState().enqueue({
            id: crypto.randomUUID(),
            type: "reply",
            threadId: id,
            reply: draft,
            status: status as "pending" | "in-progress" | "resolved",
          });
          useWorkspace.getState().setDraft(draftKey, "");
          setSubmitted(true);
        }}
      >
        <h2>Reply / update request</h2>
        <label>
          Reply
          <textarea
            aria-label="Reply"
            maxLength={3500}
            value={draft}
            onChange={(e) => {
              useWorkspace.getState().setDraft(draftKey, e.target.value);
              setSubmitted(false);
            }}
          />
        </label>
        <label>
          Status
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">Pending</option>
            <option value="in-progress">In progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
        <button type="submit" className="primary">
          Save update
        </button>
        {submitted ? (
          <p role="status">Update queued. Resolving a request does not approve its appearance.</p>
        ) : null}
      </form>
    </>
  );
}
function ToolsPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ALL TOOLS / ONE WORKSPACE</p>
          <h1>Find your tool.</h1>
          <p>Browse source art, review compositions, edit fixtures or explore generated worlds.</p>
        </div>
      </div>
      <div className="tool-grid">
        {WORKSHOP_TOOLS.map((tool) => (
          <article className="tool-card" key={tool.id}>
            <span className="tag">
              {tool.mode === "source"
                ? "Annotate"
                : tool.mode === "review"
                  ? "Review"
                  : tool.mode === "link"
                    ? "Game catalogue"
                    : "Edit / explore"}
            </span>
            <h2>{tool.name}</h2>
            <p>{tool.description}</p>
            {tool.mode === "link" ? (
              <a className="button" href={`/tilefun/${tool.url}`}>
                Open in game ↗
              </a>
            ) : (
              <Link className="button" to={`/tool/${tool.id}`}>
                Open tool →
              </Link>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
function ToolPage() {
  const { tool: toolId = "" } = useParams(),
    tool = WORKSHOP_TOOLS.find((t) => t.id === toolId),
    location = useLocation();
  if (!tool) return <Navigate to="/tools" replace />;
  if (tool.id === "patterns") return <PatternPage />;
  if (tool.id === "character-lab")
    return (
      <AuthGate>
        <CharactersPage />
      </AuthGate>
    );
  if (tool.id === "traffic") return <TrafficPage />;
  if (tool.id === "vehicles")
    return (
      <AuthGate>
        <VehiclesPage />
      </AuthGate>
    );
  if (tool.id === "outdoor") return <OutdoorPage />;
  if (tool.mode === "source") return <SourcePage />;
  if (tool.mode === "review")
    return (
      <AuthGate>
        <ReviewTool toolId={tool.id} query={location.search} />
      </AuthGate>
    );
  if (tool.mode === "link")
    return (
      <section className="empty">
        <h1>{tool.name}</h1>
        <a className="button" href={`/tilefun/${tool.url}`}>
          Open game catalogue ↗
        </a>
      </section>
    );
  return <ToolAdapter toolId={tool.id} query={location.search} />;
}
function ReviewTool({ toolId, query }: { toolId: string; query: string }) {
  const inbox = useInbox(),
    manifest = useManifest(),
    navigate = useNavigate();
  const candidates =
    (inbox.data ? reviewUnits(inbox.data.candidates) : undefined)?.filter((c) =>
      reviewToolOwnsBatch(toolId, c.batchId, manifest.data?.batches),
    ) ?? [];
  useEffect(() => {
    const p = new URLSearchParams(query);
    const target = candidates.find(
      (c) =>
        p.get("case") === c.review?.caseId ||
        p.get("case") === c.id ||
        (p.get("prefab") === c.review?.prefabIds[0] &&
          c.review?.scene === (p.get("scene") ?? "single")) ||
        (p.get("scene") && c.review?.scene === p.get("scene") && p.get("scene") !== "single"),
    );
    if (target)
      navigate(primaryScene(target) ? scenePath(target) : reviewPath(target.id) + "?show=all", {
        replace: true,
      });
  }, [query, candidates, navigate]);
  if (!inbox.data || !manifest.data) return <ErrorMessage error={inbox.error ?? manifest.error} />;
  const tool = WORKSHOP_TOOLS.find((t) => t.id === toolId);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">REVIEW TOOL</p>
          <h1>{tool?.name}</h1>
          <p>{tool?.description}</p>
        </div>
      </div>
      {manifest.data.batches
        .filter((b) => b.toolId === toolId)
        .map((b) => (
          <section className="review-batch-list" key={b.id}>
            <h2>{b.name}</h2>
            <div className="case-list">
              {candidates
                .filter((c) => c.batchId === b.id)
                .map((c) => (
                  <Link key={c.id} to={scenePath(c) + (primaryScene(c) ? "" : "?show=all")}>
                    <span>{c.name}</span>
                    <span className={`state ${c.state}`}>{candidateLabel(c)}</span>
                  </Link>
                ))}
            </div>
          </section>
        ))}
    </>
  );
}
export function legacyDestination(url: string, manifest?: WorkshopManifest) {
  const parsed = new URL(url, `${location.origin}/tilefun/`);
  if (parsed.origin !== location.origin || !parsed.pathname.startsWith("/tilefun/")) return null;
  if (parsed.pathname.endsWith("workshop.html") && parsed.hash.startsWith("#/"))
    return parsed.hash.slice(1);
  const candidate = manifest?.candidates.find(
    (c) =>
      new URL(c.url, location.origin).pathname === parsed.pathname &&
      (parsed.searchParams.get("case") === c.review?.caseId ||
        parsed.searchParams.get("case") === c.id ||
        (c.review?.scene === "single" &&
          parsed.searchParams.get("prefab") === c.review.prefabIds[0]) ||
        (["mixed", "residential", "hotel"].includes(c.review?.scene ?? "") &&
          parsed.searchParams.get("scene") === c.review?.scene)),
  );
  if (candidate)
    return primaryScene(candidate) ? scenePath(candidate) : reviewPath(candidate.id) + "?show=all";
  const tool = parsed.pathname.endsWith("building-lab.html")
    ? WORKSHOP_TOOLS.find(
        (t) =>
          t.id ===
          (["surfaces", "road-geometry"].includes(parsed.searchParams.get("run") ?? "")
            ? "roads"
            : ["districts", "commercial"].includes(parsed.searchParams.get("run") ?? "") ||
                isCityReviewRun(parsed.searchParams.get("run") ?? "")
              ? "districts"
              : parsed.searchParams.get("run") === "streets"
                ? "streets"
                : "buildings"),
      )
    : WORKSHOP_TOOLS.find(
        (t) => new URL(t.url, `${location.origin}/tilefun/`).pathname === parsed.pathname,
      );
  if (parsed.pathname.endsWith("tools.html")) return "/tools";
  return tool && tool.mode !== "link" ? `/tool/${tool.id}${parsed.search}` : null;
}
export function LegacyLink({
  url,
  children,
  className,
}: {
  url: string;
  children: ReactNode;
  className?: string;
}) {
  const manifest = useManifest(),
    destination = legacyDestination(url, manifest.data);
  return destination ? (
    <Link className={className} to={destination}>
      {children}
    </Link>
  ) : (
    <a className={className} href={url}>
      {children}
    </a>
  );
}
function ToolAdapter({ toolId, query }: { toolId: string; query: string }) {
  const tool = WORKSHOP_TOOLS.find((t) => t.id === toolId),
    navigate = useNavigate(),
    manifest = useManifest(),
    frame = useRef<HTMLIFrameElement>(null);
  if (!tool) return null;
  const url = new URL(tool.url, `${location.origin}/tilefun/`);
  new URLSearchParams(query).forEach((v, k) => {
    if (k !== "workshopEmbed") url.searchParams.set(k, v);
  });
  url.searchParams.set("workshopEmbed", "1");
  const loaded = () => {
    const document = frame.current?.contentDocument;
    if (!document) return;
    frame.current?.contentWindow?.addEventListener("tilefun:sign-in", () =>
      window.dispatchEvent(new Event("tilefun:sign-in")),
    );
    document.addEventListener("click", (event) => {
      const a = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
      if (!a || a.hasAttribute("download") || event.ctrlKey || event.metaKey || event.shiftKey)
        return;
      const destination = legacyDestination(a.href, manifest.data);
      if (destination) {
        event.preventDefault();
        navigate(destination);
      } else if (a.href.startsWith(location.origin + "/tilefun/")) {
        event.preventDefault();
        location.assign(a.href);
      }
    });
  };
  return (
    <section className="adapter-page">
      <div className="adapter-heading">
        <div>
          <h1>{tool.name}</h1>
          <p>{tool.description}</p>
        </div>
        <a
          href={url.pathname + url.search.replace(/[?&]workshopEmbed=1/, "")}
          target="_blank"
          rel="noreferrer"
        >
          Open full window ↗
        </a>
      </div>
      {tool.id === "explorer" || tool.id === "indoor" ? (
        <p className="notice compact">
          {tool.id === "explorer"
            ? "Explorer judgments stay in this browser; shared city reviews are in the inbox."
            : "Editable fixtures stay in this browser. Use the editor’s Export / Import to transfer them."}
        </p>
      ) : null}
      <iframe ref={frame} title={tool.name} src={url.pathname + url.search} onLoad={loaded} />
    </section>
  );
}
