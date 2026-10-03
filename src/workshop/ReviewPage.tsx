import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router";
import { required } from "../art/ArtCatalog.js";
import { reviewContext2D } from "../art/reviewCanvas.js";
import { reviewCases } from "../interiors/review/ReviewCases.js";
import { parseReviewPins } from "../interiors/review/ReviewFeedback.js";
import { candidateLabel, ErrorMessage, LegacyLink, reviewPath } from "./App.js";
import {
  interiorFingerprint,
  loadReviewAtlas,
  renderInteriorCandidate,
} from "./InteriorCandidates.js";
import { buildPatternCandidate, renderPatternCandidate } from "./PatternCandidates.js";
import { PreviewViewport } from "./PreviewViewport.js";
import { buildRailwayCandidate } from "./RailwayCandidates.js";
import { RailwayPlayback } from "./RailwayPlayback.js";
import { reviewAssets } from "./ReviewAssets.js";
import { artReviewDefinitions, buildArtCandidate, renderArtCandidate } from "./ReviewCandidates.js";
import { primaryScene, scenePath } from "./SceneReview.js";
import { useInbox, useManifest } from "./WorkshopQueries.js";
import type { CandidateSummary, WorkshopCandidate, WorkshopEvent } from "./WorkshopTypes.js";
import {
  initialQueue,
  legacyDraft,
  legacyValue,
  persistQueue,
  type ReviewQueue,
  useWorkspace,
} from "./WorkspaceStore.js";

function optimisticSummary(c: CandidateSummary, events: WorkshopEvent[]): CandidateSummary {
  const e = events
    .filter(
      (e): e is Extract<WorkshopEvent, { type: "review" }> =>
        e.type === "review" && e.candidateId === c.id && e.fingerprint === c.fingerprint,
    )
    .at(-1);
  return e
    ? {
        ...c,
        state:
          e.verdict === "approved" ? "approved" : e.verdict === "changes" ? "changes" : "unchecked",
      }
    : c;
}
const visibleIn = (c: CandidateSummary, filter: ReviewQueue["filter"]) =>
  !c.excluded &&
  (filter === "all" || filter === "unchecked"
    ? ["unchecked", "changed"].includes(c.state) || filter === "all"
    : c.state === filter);

export default function ReviewPage() {
  const { id = "" } = useParams(),
    inbox = useInbox(),
    manifest = useManifest();
  const refresh = inbox.refetch;
  useEffect(() => {
    if (id) void refresh();
  }, [id, refresh]);
  const candidate = inbox.data?.candidates.find((c) => c.id === id);
  if (!inbox.data || !manifest.data) return <ErrorMessage error={inbox.error ?? manifest.error} />;
  if (!candidate)
    return (
      <section className="empty">
        <h1>This candidate is no longer available.</h1>
        <Link to="/">Return to inbox →</Link>
      </section>
    );
  if (candidate.kind === "character")
    return <Navigate to={`/tool/character-lab?character=${candidate.characterId}`} replace />;
  if (candidate.kind === "vehicle")
    return <Navigate to={`/tool/vehicles?view=${encodeURIComponent(candidate.id)}`} replace />;
  if (candidate.kind === "motion")
    return (
      <section className="empty">
        <h1>{candidate.name}</h1>
        <p>
          Movement needs a playable review. The inbox summarizes the default scene; custom layouts
          remain reviewable in the tool.
        </p>
        <LegacyLink className="button" url={candidate.url}>
          Open movement lab →
        </LegacyLink>
      </section>
    );
  return (
    <ReviewCase
      candidate={candidate}
      currentManifest={inbox.data.manifestCurrent}
      allCandidates={inbox.data.candidates}
      batchName={
        manifest.data.batches.find((b) => b.id === candidate.batchId)?.name ?? candidate.batchId
      }
    />
  );
}
function ReviewCase({
  candidate: c,
  currentManifest,
  allCandidates,
  batchName,
}: {
  candidate: CandidateSummary;
  currentManifest: boolean;
  allCandidates: CandidateSummary[];
  batchName: string;
}) {
  const navigate = useNavigate(),
    location = useLocation(),
    canvas = useRef<HTMLCanvasElement>(null),
    textarea = useRef<HTMLTextAreaElement>(null);
  const outbox = useWorkspace((s) => s.outbox),
    queue = useWorkspace((s) => s.queues[c.batchId]),
    drafts = useWorkspace((s) => s.drafts);
  const [geometry, setGeometry] = useState(false),
    [ready, setReady] = useState(""),
    [error, setError] = useState(""),
    [pins, setPins] = useState<{ x: number; y: number; size: 16 | 32 }[]>([]),
    [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const rows = allCandidates
    .filter((candidate) => candidate.batchId === c.batchId)
    .map((candidate) => optimisticSummary(candidate, outbox));
  const summary = optimisticSummary(c, outbox),
    initial = initialQueue(c.batchId),
    q = queue ?? initial;
  const effectiveFilter =
    new URLSearchParams(location.search).get("show") === "all" ? "all" : q.filter;
  const visible = rows.filter((c) => visibleIn(c, effectiveFilter)),
    index = visible.findIndex((row) => row.id === c.id);
  const draftKey = c.id,
    draft = drafts[draftKey] ?? "";
  function saveQueue(next: ReviewQueue) {
    useWorkspace.getState().setQueue(c.batchId, next);
    persistQueue(c.batchId, next);
  }
  useEffect(() => {
    const store = useWorkspace.getState();
    const next = store.queues[c.batchId] ?? initialQueue(c.batchId);
    const explicitAll = new URLSearchParams(location.search).get("show") === "all";
    if (next.selected !== c.id || (explicitAll && next.filter !== "all")) {
      const updated = {
        ...next,
        selected: c.id,
        ...(explicitAll ? { filter: "all" as const } : {}),
      };
      store.setQueue(c.batchId, updated);
      persistQueue(c.batchId, updated);
    }
    if (store.drafts[c.id] === undefined) {
      let old = "";
      if (c.review) {
        const key = c.review.caseId ? c.id : `${c.review.scene}:${c.review.prefabIds.join(",")}`;
        old = legacyDraft(key);
      } else {
        const oldState = legacyValue("tilefun.indoor-review.v1");
        if (oldState.current === c.id && typeof oldState.draft === "string") old = oldState.draft;
      }
      store.setDraft(c.id, old);
    }
    const storedPins = store.drafts[`pins:${c.id}:${c.fingerprint}`];
    const annotation = legacyValue("tilefun.indoor-review.v1").annotation as
      | { caseId?: string; fingerprint?: string; pins?: unknown }
      | undefined;
    try {
      setPins(
        parseReviewPins(
          storedPins
            ? JSON.parse(storedPins)
            : annotation?.caseId === c.id && annotation?.fingerprint === c.fingerprint
              ? annotation.pins
              : [],
          c.interior?.sketch ?? "",
        ),
      );
    } catch {
      setPins([]);
    }
    setError("");
    setReady("");
  }, [c.id, c.batchId, location.search, c.review, c.fingerprint, c.interior?.sketch]);
  useEffect(() => {
    const stored = useWorkspace.getState().queues[c.batchId];
    if (!stored) return;
    const valid = stored.batch.filter((report) =>
      allCandidates.some(
        (row) =>
          row.batchId === c.batchId &&
          row.id === report.id &&
          row.fingerprint === report.fingerprint &&
          optimisticSummary(row, outbox).state === "changes",
      ),
    );
    if (valid.length !== stored.batch.length) {
      const next = { ...stored, batch: valid, paused: valid.length >= 2 && stored.paused };
      useWorkspace.getState().setQueue(c.batchId, next);
      persistQueue(c.batchId, next);
    }
  }, [allCandidates, outbox, c.batchId]);
  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      const temporary = document.createElement("canvas");
      if (c.kind === "railway") {
        const actual = await buildRailwayCandidate(temporary, c.id);
        if (actual.fingerprint !== c.fingerprint || actual.review?.revision !== c.review?.revision)
          throw new Error("Railway preview changed. Regenerate the manifest before reviewing.");
      } else if (c.kind === "pattern") {
        const { assets, catalog } = await reviewAssets();
        const actual = await buildPatternCandidate(
          temporary,
          c.id.replace(/^pattern:/, ""),
          assets,
          catalog,
        );
        if (actual.fingerprint !== c.fingerprint || actual.review?.revision !== c.review?.revision)
          throw new Error("Pattern changed. Regenerate the manifest before reviewing.");
        if (geometry) renderPatternCandidate(temporary, c.id, assets, true);
      } else if (c.kind === "art") {
        const definition = required(artReviewDefinitions().find((d) => d.id === c.id)),
          { assets, catalog } = await reviewAssets();
        const actual = await buildArtCandidate(temporary, definition, assets, catalog);
        if (actual.fingerprint !== c.fingerprint || actual.review?.revision !== c.review?.revision)
          throw new Error(
            "This render differs from the registered candidate. Regenerate the manifest before reviewing.",
          );
        if (geometry) await renderArtCandidate(temporary, definition, assets, true);
      } else {
        const fixture = required(reviewCases().find((row) => row.id === c.id)),
          atlas = await loadReviewAtlas();
        renderInteriorCandidate(temporary, fixture, atlas);
        if ((await interiorFingerprint(temporary, fixture)) !== c.fingerprint)
          throw new Error("Room appearance changed. Regenerate the manifest before reviewing.");
      }
      if (cancelled || !canvas.current) return;
      canvas.current.width = temporary.width;
      canvas.current.height = temporary.height;
      reviewContext2D(canvas.current).drawImage(temporary, 0, 0);
      setDimensions({ width: temporary.width, height: temporary.height });
      setReady(c.id);
      setError("");
    };
    void render().catch((error) => {
      if (!cancelled) {
        setError(error instanceof Error ? error.message : String(error));
        setReady("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [c.id, c.fingerprint, c.review?.revision, c.kind, geometry]);
  function changePins(next: typeof pins) {
    setPins(next);
    useWorkspace.getState().setDraft(`pins:${c.id}:${c.fingerprint}`, JSON.stringify(next));
    if (c.kind === "interior") mirrorRoomDraft(draft, next);
  }
  function mirrorRoomDraft(value: string, next = pins) {
    try {
      localStorage.setItem(
        "tilefun.indoor-review.v1",
        JSON.stringify({
          ...legacyValue("tilefun.indoor-review.v1"),
          current: c.id,
          draft: value,
          annotation: next.length ? { caseId: c.id, fingerprint: c.fingerprint, pins: next } : null,
        }),
      );
    } catch {
      /* persisted Workshop copy */
    }
  }
  function changeDraft(value: string) {
    if (c.kind === "interior") mirrorRoomDraft(value);
    useWorkspace.getState().setDraft(draftKey, value);
    if (c.review) {
      const key = c.review.caseId ? c.id : `${c.review.scene}:${c.review.prefabIds.join(",")}`;
      try {
        localStorage.setItem(
          "tilefun.building-drafts.v1",
          JSON.stringify({ ...legacyValue("tilefun.building-drafts.v1"), [key]: value }),
        );
      } catch {
        /* persisted Workshop copy */
      }
    }
  }
  function open(candidate: WorkshopCandidate, filter = effectiveFilter) {
    saveQueue({ ...q, filter, selected: candidate.id });
    navigate(reviewPath(candidate.id) + (filter === "all" ? "?show=all" : ""));
  }
  function move(direction: number) {
    if (q.paused || visible.length < 2) return;
    const next = visible[(Math.max(index, 0) + direction + visible.length) % visible.length];
    if (next) open(next);
  }
  function vote(verdict: "approved" | "changes" | "clear") {
    if (ready !== c.id || q.paused || !currentManifest) return;
    if (verdict === "changes" && !draft.trim()) {
      setError("Add a reason for Needs changes.");
      textarea.current?.focus();
      return;
    }
    const eventId = crypto.randomUUID();
    useWorkspace.getState().enqueue({
      id: eventId,
      type: "review",
      candidateId: c.id,
      fingerprint: c.fingerprint,
      verdict,
      note: draft,
      ...(pins.length ? { pins } : {}),
    });
    let batch = q.batch.filter((report) => report.id !== c.id);
    if (verdict === "changes")
      batch = [...batch, { id: c.id, fingerprint: c.fingerprint, eventId, note: draft }].slice(-2);
    const paused = batch.length >= 2;
    const nextQueue = { ...q, filter: effectiveFilter, batch, paused };
    saveQueue(nextQueue);
    changeDraft("");
    useWorkspace.getState().setDraft(`pins:${c.id}:${c.fingerprint}`, "[]");
    if (c.kind === "interior") mirrorRoomDraft("", []);
    setPins([]);
    setError("");
    if (!paused) {
      const next = rows
        .slice(index + 1)
        .concat(rows.slice(0, index + 1))
        .find((row) => row.id !== c.id && visibleIn(row, effectiveFilter));
      if (next) {
        saveQueue({ ...nextQueue, selected: next.id });
        navigate(reviewPath(next.id) + (effectiveFilter === "all" ? "?show=all" : ""));
      }
    }
  }
  const latest = rows
    .filter((row) => row.lastDecision && ["approved", "changes"].includes(row.state))
    .sort((a, b) => (b.lastDecision ?? "").localeCompare(a.lastDecision ?? ""))
    .at(0);
  function undo() {
    if (!latest || !currentManifest) return;
    useWorkspace.getState().enqueue({
      id: crypto.randomUUID(),
      type: "review",
      candidateId: latest.id,
      fingerprint: latest.fingerprint,
      verdict: "clear",
      note: "Reopened for review.",
    });
    const next = {
      ...q,
      paused: false,
      filter: "unchecked" as const,
      batch: q.batch.filter((e) => e.id !== latest.id),
      selected: latest.id,
    };
    saveQueue(next);
    navigate(reviewPath(latest.id));
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        (event.target instanceof HTMLElement &&
          (event.target.closest("input,textarea,select,button,a") ||
            event.target.isContentEditable)) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat
      )
        return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        move(event.key === "ArrowRight" ? 1 : -1);
      } else if (event.code === "Space") {
        event.preventDefault();
        vote("approved");
      } else if (event.key.toLowerCase() === "x") {
        event.preventDefault();
        vote("changes");
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        textarea.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const canVote = ready === c.id && currentManifest && !q.paused && !c.excluded;
  return (
    <section
      className="review-page"
      data-railway={c.kind === "railway"}
      data-candidate={c.id}
      data-review-ready={ready === c.id}
    >
      <Link className="back-link" to="/">
        ← Global review inbox
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{batchName}</p>
          <h1>{c.name}</h1>
          <p>{c.prompt}</p>
        </div>
        <span className={`state ${summary.state}`}>{candidateLabel(summary)}</span>
      </div>
      <div className="review-navigation">
        <button type="button" disabled={q.paused || visible.length < 2} onClick={() => move(-1)}>
          ← Previous
        </button>
        <button type="button" disabled={q.paused || visible.length < 2} onClick={() => move(1)}>
          Next →
        </button>
        <label>
          Show
          <select
            aria-label="Show"
            value={effectiveFilter}
            onChange={(e) => {
              const filter = e.target.value as ReviewQueue["filter"];
              saveQueue({ ...q, filter });
              const first = rows.find((row) => visibleIn(row, filter));
              if (first) open(first, filter);
              else navigate(reviewPath(c.id) + (filter === "all" ? "?show=all" : ""));
            }}
          >
            <option value="unchecked">Unchecked</option>
            <option value="all">All candidates</option>
            <option value="approved">Approved</option>
            <option value="changes">Needs changes</option>
          </select>
        </label>
        <span>
          {index < 0 ? 0 : index + 1}/{visible.length} ·{" "}
          {rows.filter((r) => r.state === "approved").length} approved
        </span>
        <button type="button" onClick={undo} disabled={!latest || !currentManifest}>
          Undo last review
        </button>
      </div>
      {!currentManifest ? (
        <p className="notice error">
          Manifest needs regeneration. Voting is disabled until these are current appearances.
        </p>
      ) : null}
      {q.paused ? (
        <section className="empty review-pause">
          <h2>Ready for the next fix.</h2>
          <p>
            Your two reports are captured. Check the save status above, then say “ready” in chat.
          </p>
          <ul>
            {q.batch.map((report) => (
              <li key={report.eventId || report.id}>
                {allCandidates.find((c) => c.id === report.id)?.name ?? report.id}: {report.note}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => saveQueue({ ...q, paused: false, batch: [] })}>
            Keep reviewing
          </button>
          <button type="button" onClick={() => locationReload()}>
            Check for updates
          </button>
        </section>
      ) : null}
      {!q.paused && !visible.length ? (
        <section className="empty">
          <h2>No candidates in this queue.</h2>
          <p>
            Approved and reported appearances leave Unchecked. Changed appearances return
            automatically.
          </p>
          <button type="button" onClick={() => open(c, "all")}>
            Show all candidates
          </button>
        </section>
      ) : null}
      <div className="review-content" hidden={q.paused || !visible.length}>
        <div className="native-preview">
          {c.kind === "railway" ? (
            <RailwayPlayback
              key={`playback:${c.id}`}
              id={c.id}
              canvas={canvas}
              ready={ready === c.id}
              geometry={geometry}
              onError={setError}
            />
          ) : null}
          <PreviewViewport
            key={c.id}
            width={dimensions.width}
            height={dimensions.height}
            status={
              ready !== c.id && !error ? (
                <p role="status">Checking the exact current render…</p>
              ) : null
            }
            controls={
              c.kind === "art" || c.kind === "pattern" || c.kind === "railway" ? (
                <label>
                  <input
                    type="checkbox"
                    checked={geometry}
                    onChange={(e) => setGeometry(e.target.checked)}
                  />{" "}
                  Geometry / routes
                </label>
              ) : (
                <span>Tap the render to pin a problem.</span>
              )
            }
          >
            <canvas
              ref={canvas}
              aria-label="Candidate preview"
              onClick={(event) => {
                if (c.kind !== "interior" || !canVote) return;
                const bounds = event.currentTarget.getBoundingClientRect(),
                  x =
                    Math.floor(
                      ((event.clientX - bounds.left) * dimensions.width) / bounds.width / 16,
                    ) * 16,
                  y =
                    Math.floor(
                      ((event.clientY - bounds.top) * dimensions.height) / bounds.height / 16,
                    ) * 16;
                if (
                  x < 0 ||
                  y < 0 ||
                  y >= (c.interior?.sketch.split("\n").length ?? 0) * 32 ||
                  pins.length >= 20
                )
                  return;
                if (!pins.some((p) => p.x === x && p.y === y))
                  changePins([...pins, { x, y, size: 16 }]);
              }}
            />
            {pins.length ? (
              <svg
                aria-label="Report pins"
                viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
                className="pin-overlay"
              >
                {pins.map((p) => (
                  <rect
                    key={`${p.x},${p.y}`}
                    x={p.x}
                    y={p.y}
                    width={p.size}
                    height={p.size}
                    fill="#ff665533"
                    stroke="#ff6655"
                    strokeWidth="1"
                  />
                ))}
              </svg>
            ) : null}
          </PreviewViewport>
        </div>
        <aside className="review-inspector">
          <h2>Your review</h2>
          <label>
            Note
            <textarea
              aria-label="Note"
              ref={textarea}
              maxLength={c.kind === "interior" ? 2000 : 3500}
              value={draft}
              onChange={(e) => changeDraft(e.target.value)}
              placeholder="What should change? A reason is required for Needs changes."
            />
          </label>
          {pins.length ? (
            <div className="pin-list">
              {pins.map((p) => (
                <button
                  type="button"
                  key={`${p.x},${p.y}`}
                  onClick={() => changePins(pins.filter((v) => v !== p))}
                >
                  Pin {p.x},{p.y} ×
                </button>
              ))}
            </div>
          ) : null}
          <div className="review-actions">
            <button
              type="button"
              className="primary"
              disabled={!canVote}
              onClick={() => vote("approved")}
            >
              Looks right ✓
            </button>
            <button
              type="button"
              className="report"
              disabled={!canVote}
              onClick={() => vote("changes")}
            >
              Needs changes ✕
            </button>
          </div>
          <p className="muted">
            Space approves · X reports · arrows navigate. Two reports pause this batch.
          </p>
          <ErrorMessage error={error} />
          <label>
            Jump to case
            <select
              aria-label="Jump to case"
              value={c.id}
              onChange={(e) => {
                const next = rows.find((row) => row.id === e.target.value);
                if (next) open(next, visibleIn(next, effectiveFilter) ? effectiveFilter : "all");
              }}
            >
              {rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          {primaryScene(c) ? (
            <Link className="button" to={scenePath(c)}>
              Open neighborhood workspace →
            </Link>
          ) : null}

          {c.kind === "pattern" ? (
            <Link
              className="button"
              to={`/tool/patterns?family=fenced-trees-v1&case=${c.review?.caseId}`}
            >
              Draw with this kit →
            </Link>
          ) : null}
          {c.art ? (
            <LegacyLink
              url={`/tilefun/art-workbench.html?sheet=${c.art.sheetId}&rect=${c.art.rect.join(",")}`}
            >
              Inspect source art →
            </LegacyLink>
          ) : null}
          <a href={c.url} target="_blank" rel="noreferrer">
            Original lab view ↗
          </a>
          {c.exploreUrl ? <Link to={c.exploreUrl}>Explore / play this neighborhood →</Link> : null}
          {c.interior ? (
            <details>
              <summary>Floor plan & case</summary>
              <pre>{c.interior.sketch}</pre>
              <code>{c.id}</code>
            </details>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
function locationReload() {
  window.location.reload();
}
