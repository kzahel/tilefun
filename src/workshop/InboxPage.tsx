import { useState } from "react";
import { Link } from "react-router";
import { primaryScene, reviewUnits, scenePath } from "./SceneReview.js";
import { WORKSHOP_TOOLS } from "./ToolRegistry.js";
import { ErrorMessage } from "./WorkshopCommon.js";
import { useInbox, useManifest } from "./WorkshopQueries.js";
import type { CandidateSummary, ReviewBatch } from "./WorkshopTypes.js";

export function InboxPage() {
  const inbox = useInbox(),
    manifest = useManifest(),
    [filter, setFilter] = useState("pending"),
    [area, setArea] = useState("all");
  if (inbox.isPending || manifest.isPending) return <p role="status">Loading review batches…</p>;
  if (!inbox.data || !manifest.data) return <ErrorMessage error={inbox.error ?? manifest.error} />;
  const candidates = reviewUnits(inbox.data.candidates),
    batches = manifest.data.batches.filter((b) => {
      const interiors = WORKSHOP_TOOLS.find((t) => t.id === b.toolId)?.area === "interiors";
      return area === "all" || (area === "city" ? !interiors : interiors);
    });
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
      {!(inbox.data.reviewAllowed ?? inbox.data.manifestCurrent) ? (
        <p className="notice error">
          Candidate inputs changed since the last manifest render. Review is paused until the
          current manifest is generated; stale approvals are not counted.
        </p>
      ) : !inbox.data.manifestCurrent ? (
        <p className="notice">
          Development is continuing. You can review previews that still match their saved version.
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
        {batches.map((batch) => (
          <BatchCard
            key={batch.id}
            batch={batch}
            rows={candidates.filter((c) => c.batchId === batch.id)}
            filter={filter}
          />
        ))}
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

/** Motion candidates open the motion tool; everything else opens its scene or review page. */
function batchLink(first: CandidateSummary, pendingCount: number, filter: string): string {
  return first.kind === "motion"
    ? `/tool/motion?${new URL(first.url, location.origin).searchParams}`
    : scenePath(first) + (!pendingCount && filter !== "changes" ? "?show=all" : "");
}

function hiddenByFilter(
  filter: string,
  pending: CandidateSummary[],
  changes: CandidateSummary[],
  approved: CandidateSummary[],
): boolean {
  return (
    (filter === "pending" && !pending.length) ||
    (filter === "changes" && !changes.length) ||
    (filter === "approved" && !approved.length)
  );
}

function BatchCard({
  batch,
  rows,
  filter,
}: {
  batch: ReviewBatch;
  rows: CandidateSummary[];
  filter: string;
}) {
  const pending = rows.filter((c) => ["unchecked", "changed"].includes(c.state)),
    changes = rows.filter((c) => c.state === "changes"),
    approved = rows.filter((c) => c.state === "approved");
  if (hiddenByFilter(filter, pending, changes, approved)) return null;
  const first = (filter === "changes" ? changes[0] : pending[0]) ?? rows.find((c) => !c.excluded);
  return (
    <article className="batch-card" data-batch={batch.id}>
      <div className="card-top">
        <span className="tag">{WORKSHOP_TOOLS.find((t) => t.id === batch.toolId)?.name}</span>
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
        <Link className="button" to={batchLink(first, pending.length, filter)}>
          {pending.length ? "Continue review" : "Inspect batch"} →
        </Link>
      ) : (
        <span>No reviewable cases</span>
      )}
    </article>
  );
}
