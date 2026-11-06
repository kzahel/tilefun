import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { workshopJson } from "./AuthClient.js";
import { ErrorMessage, LegacyLink, threadPath } from "./WorkshopCommon.js";
import { useInbox } from "./WorkshopQueries.js";
import type { WorkshopActivity, WorkshopThread } from "./WorkshopTypes.js";
import { useWorkspace } from "./WorkspaceStore.js";

export function RequestsPage() {
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
export function ActivityPage() {
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
export function ThreadPage() {
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
