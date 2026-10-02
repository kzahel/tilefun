import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { type AssetSuggestion, selectedSceneFeatures } from "../art/ArtAnnotations.js";
import { type ArtRect, required } from "../art/ArtCatalog.js";
import { sha256 } from "../art/ArtSource.js";
import {
  ALL_DENSE_REVIEW_CASES,
  denseReviewScene,
  drawDenseDistrictShowcase,
} from "../art/DenseDistrictShowcase.js";
import type { OutdoorAsset, OutdoorMetadata } from "../assets/outdoor/OutdoorCatalog.js";
import { candidateLabel, ErrorMessage, threadPath } from "./App.js";
import { AssetThumbnail, OutdoorAssetBrowser } from "./OutdoorAssetBrowser.js";
import { catalogAssets, useArtNotes, useOutdoorCatalog } from "./OutdoorQueries.js";
import { PreviewViewport } from "./PreviewViewport.js";
import { reviewAssets } from "./ReviewAssets.js";
import { artReviewDefinitions, buildArtCandidate } from "./ReviewCandidates.js";
import { primaryScene } from "./SceneReview.js";
import { useInbox } from "./WorkshopQueries.js";
import { useWorkspace } from "./WorkspaceStore.js";
export default function ScenePage() {
  const { id = "" } = useParams(),
    inbox = useInbox(),
    location = useLocation(),
    notes = useArtNotes(),
    outdoor = useOutdoorCatalog();
  const candidate = inbox.data?.candidates.find(
    (c) => c.id === `district:${id}` && primaryScene(c) === id,
  );
  if (!candidate)
    return <ErrorMessage error={inbox.error ?? "Full neighborhood scene not found"} />;
  return (
    <Neighborhood
      key={`${id}:${candidate.fingerprint}`}
      id={id}
      candidate={candidate}
      current={!!inbox.data?.manifestCurrent}
      focusId={new URLSearchParams(location.search).get("focus") ?? ""}
      noteId={new URLSearchParams(location.search).get("note") ?? ""}
      notes={notes.data ?? []}
      outdoor={outdoor.data}
    />
  );
}
function Neighborhood({
  id,
  candidate,
  current,
  focusId,
  noteId,
  notes,
  outdoor,
}: {
  id: string;
  candidate: NonNullable<ReturnType<typeof useInbox>["data"]>["candidates"][number];
  current: boolean;
  focusId: string;
  noteId: string;
  notes: NonNullable<ReturnType<typeof useArtNotes>["data"]>;
  outdoor: ReturnType<typeof useOutdoorCatalog>["data"];
}) {
  const definition = required(
    ALL_DENSE_REVIEW_CASES.find((c) => c.id === id && c.window === "whole"),
  );
  const scene = useMemo(() => denseReviewScene(definition), [definition]),
    b = scene.bounds;
  const origin = [b.minX * 16, b.minY * 16],
    width = (b.maxX - b.minX) * 16,
    height = (b.maxY - b.minY) * 16;
  const key = `scene:${id}:${candidate.fingerprint}`,
    drafts = useWorkspace((s) => s.drafts),
    outbox = useWorkspace((s) => s.outbox),
    canvas = useRef<HTMLCanvasElement>(null);
  const [selection, setSelection] = useState<ArtRect | null>(() => {
      try {
        return JSON.parse(drafts[`region:${key}`] ?? "null");
      } catch {
        return null;
      }
    }),
    [suggestions, setSuggestions] = useState<AssetSuggestion[]>(() => {
      try {
        return JSON.parse(drafts[`assets:${key}`] ?? "[]");
      } catch {
        return [];
      }
    }),
    [mode, setMode] = useState("pan"),
    [ready, setReady] = useState(false),
    [geometry, setGeometry] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(""),
    [picker, setPicker] = useState(false),
    [showResolved, setShowResolved] = useState(false),
    [focus, setFocus] = useState<
      { x: number; y: number; width: number; height: number; key: string } | undefined
    >();
  const drag = useRef<{ x: number; y: number } | null>(null),
    note = drafts[`note:${key}`] ?? "";
  const related = notes.filter(
    (n) =>
      n.sceneAnnotation?.candidateId === candidate.id ||
      (n.buildingReview?.scene === "district" &&
        inboxCaseBatch(n.buildingReview.caseId ?? "") === candidate.batchId),
  );
  const visibleComments = related.filter(
    (n) =>
      n.threadId === noteId ||
      (n.status !== "resolved" && n.buildingVerdict?.value !== "approved") ||
      showResolved,
  );
  const shortcuts = ALL_DENSE_REVIEW_CASES.filter(
    (c) => c !== definition && inboxCaseBatch(c.id) === candidate.batchId,
  );
  function focusRect(rect: ArtRect, label: string) {
    setFocus({
      x: rect[0] - origin[0]!,
      y: rect[1] - origin[1]!,
      width: rect[2],
      height: rect[3],
      key: label,
    });
  }
  function shortcut(caseId: string) {
    const c = shortcuts.find((c) => c.id === caseId);
    if (!c) return;
    const r = denseReviewScene(c).bounds;
    focusRect([r.minX * 16, r.minY * 16, (r.maxX - r.minX) * 16, (r.maxY - r.minY) * 16], caseId);
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only explicit navigation selects a focus; ordinary inbox refresh must not reset the camera.
  useEffect(() => {
    if (focusId) shortcut(focusId);
    if (noteId) {
      const n = notes.find((n) => n.threadId === noteId)?.sceneAnnotation;
      if (n) focusRect(n.rect, noteId);
    }
  }, [focusId, noteId, notes.length]);
  useEffect(() => {
    useWorkspace.getState().setDraft(`region:${key}`, JSON.stringify(selection));
  }, [key, selection]);
  useEffect(() => {
    useWorkspace.getState().setDraft(`assets:${key}`, JSON.stringify(suggestions));
  }, [key, suggestions]);
  useEffect(() => {
    let active = true;
    setReady(false);
    void (async () => {
      const { assets, catalog } = await reviewAssets(),
        temporary = document.createElement("canvas"),
        d = required(artReviewDefinitions().find((d) => d.id === candidate.id));
      const rendered = await buildArtCandidate(temporary, d, assets, catalog);
      if (rendered.fingerprint !== candidate.fingerprint)
        throw new Error(
          "Neighborhood appearance changed. Refresh current manifest before annotating.",
        );
      if (geometry) drawDenseDistrictShowcase(temporary, scene, assets, true);
      if (!active || !canvas.current) return;
      canvas.current.width = temporary.width;
      canvas.current.height = temporary.height;
      required(canvas.current.getContext("2d")).drawImage(temporary, 0, 0);
      setReady(true);
      setError("");
    })().catch((e) => {
      if (active) setError(String(e));
    });
    return () => {
      active = false;
    };
  }, [candidate.id, candidate.fingerprint, geometry, scene]);
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(width - 1, Math.max(0, ((e.clientX - r.left) * width) / r.width)),
      y: Math.min(height - 1, Math.max(0, ((e.clientY - r.top) * height) / r.height)),
    };
  };
  function region(start: { x: number; y: number }, end: { x: number; y: number }): ArtRect {
    const x = Math.floor(Math.min(start.x, end.x) / 16) * 16,
      y = Math.floor(Math.min(start.y, end.y) / 16) * 16;
    return [
      origin[0]! + x,
      origin[1]! + y,
      Math.min(width, Math.floor(Math.max(start.x, end.x) / 16) * 16 + 16) - x,
      Math.min(height, Math.floor(Math.max(start.y, end.y) / 16) * 16 + 16) - y,
    ];
  }
  const selectedFeatures = selection ? selectedSceneFeatures(scene.props, selection) : [];
  async function suggest(asset: OutdoorAsset) {
    if (!outdoor) return;
    const metadata: OutdoorMetadata = asset.metadata;
    const s: AssetSuggestion = {
      assetId: asset.id,
      rect: asset.rect,
      sourceFingerprint: outdoor.catalog.sourceFingerprint,
      metadataFingerprint: await sha256(new TextEncoder().encode(JSON.stringify(metadata))),
      metadata,
    };
    setSuggestions((old) => [...old.filter((s) => s.assetId !== asset.id), s].slice(0, 12));
    setSaved("");
  }
  function save() {
    if (!selection || !note.trim()) {
      setError("Select an area and leave a location note first");
      return;
    }
    useWorkspace.getState().enqueue({
      id: crypto.randomUUID(),
      type: "scene",
      candidateId: candidate.id,
      fingerprint: candidate.fingerprint,
      rect: selection,
      featureIds: selectedFeatures.flatMap((p) => (p.proceduralId ? [p.proceduralId] : [])),
      suggestions,
      note: note.trim(),
    });
    useWorkspace.getState().setDraft(`note:${key}`, "");
    setSuggestions([]);
    setSaved("Location note and asset suggestions queued for the shared inbox.");
    setError("");
  }
  function vote(verdict: "approved" | "changes") {
    if (verdict === "changes" && !note.trim()) {
      setError("Leave an overall reason for the requested scene changes");
      return;
    }
    useWorkspace.getState().enqueue({
      id: crypto.randomUUID(),
      type: "review",
      candidateId: candidate.id,
      fingerprint: candidate.fingerprint,
      verdict,
      note,
    });
    setSaved("Whole-scene decision queued. Location comments keep their own status.");
  }
  const last = outbox.filter((e) => e.type === "review" && e.candidateId === candidate.id).at(-1),
    state = last?.type === "review" ? last.verdict : candidate.state;
  return (
    <section className="scene-page" data-scene={id} data-scene-ready={ready}>
      <Link className="back-link" to="/">
        ← Global review inbox
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ONE NEIGHBORHOOD / LOCATION NOTES</p>
          <h1>{candidate.name}</h1>
          <p>
            Inspect the whole scene, select an area and suggest art. Zoom shortcuts share this
            scene’s approval.
          </p>
        </div>
        <span className={`state ${state}`}>{last ? state : candidateLabel(candidate)}</span>
      </div>
      <div className="scene-shortcuts">
        <button
          type="button"
          onClick={() => setFocus({ x: 0, y: 0, width, height, key: crypto.randomUUID() })}
        >
          Whole neighborhood
        </button>
        {shortcuts.map((c) => (
          <button type="button" key={c.id} onClick={() => shortcut(c.id)}>
            {c.name}
          </button>
        ))}
      </div>
      <div className="review-content">
        <div className="native-preview">
          <PreviewViewport
            width={width}
            height={height}
            selecting={mode === "select"}
            focus={focus}
            controls={
              <>
                <label>
                  Scene tool
                  <select
                    aria-label="Scene tool"
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    <option value="pan">Pan neighborhood</option>
                    <option value="select">Select area / pin</option>
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={geometry}
                    onChange={(e) => setGeometry(e.target.checked)}
                  />{" "}
                  Geometry / routes
                </label>
              </>
            }
            status={!ready ? <p role="status">Checking exact scene pixels…</p> : null}
          >
            <canvas
              ref={canvas}
              aria-label="Neighborhood preview"
              onPointerDown={(e) => {
                if (mode !== "select" || e.button !== 0 || !ready) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = point(e);
                setSelection(region(drag.current, drag.current));
                setSaved("");
              }}
              onPointerMove={(e) => {
                if (drag.current) setSelection(region(drag.current, point(e)));
              }}
              onPointerUp={(e) => {
                if (drag.current) setSelection(region(drag.current, point(e)));
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
            />
            <svg
              className="scene-selection"
              aria-label="Scene annotation regions"
              viewBox={`0 0 ${width} ${height}`}
            >
              {visibleComments
                .filter(
                  (n) =>
                    n.sceneAnnotation &&
                    n.sceneAnnotation.renderFingerprint === candidate.fingerprint,
                )
                .map((n) => {
                  const r = n.sceneAnnotation!.rect;
                  return (
                    <rect
                      key={n.threadId}
                      x={r[0] - origin[0]!}
                      y={r[1] - origin[1]!}
                      width={r[2]}
                      height={r[3]}
                      fill={n.status === "resolved" ? "#22ab6622" : "#e9785122"}
                      stroke={n.status === "resolved" ? "#22ab66" : "#e97851"}
                      strokeWidth={2}
                    />
                  );
                })}
              {selection ? (
                <rect
                  x={selection[0] - origin[0]!}
                  y={selection[1] - origin[1]!}
                  width={selection[2]}
                  height={selection[3]}
                  fill="#f5bd3b33"
                  stroke="#bd8414"
                  strokeWidth={2}
                />
              ) : null}
            </svg>
          </PreviewViewport>
          <ErrorMessage error={error} />
        </div>
        <aside className="review-inspector">
          <h2>Location feedback</h2>
          {selection ? (
            <p>
              World tiles {Math.floor(selection[0] / 16)}, {Math.floor(selection[1] / 16)} ·{" "}
              {selection[2] / 16} × {selection[3] / 16}
              <br />
              {selectedFeatures.length} intersecting props
            </p>
          ) : (
            <p>Choose Select area / pin and tap or drag over the neighborhood.</p>
          )}
          <label>
            Location note
            <textarea
              aria-label="Location note"
              maxLength={3500}
              value={note}
              onChange={(e) => useWorkspace.getState().setDraft(`note:${key}`, e.target.value)}
            />
          </label>
          <button type="button" onClick={() => setPicker(!picker)} disabled={!outdoor}>
            {picker ? "Close asset browser" : "Browse props to suggest"}
          </button>
          <div className="asset-suggestions">
            {suggestions.map((s) => (
              <article key={s.assetId}>
                {outdoor ? (
                  <AssetThumbnail
                    asset={{
                      ...s,
                      id: s.assetId,
                      visualBounds: [0, 0, s.rect[2], s.rect[3]],
                      aliases: [],
                      evidence: "candidate",
                      runtimeTypes: [],
                    }}
                    image={outdoor.image}
                  />
                ) : null}
                <strong>{s.metadata.name}</strong>
                <button
                  type="button"
                  onClick={() => setSuggestions(suggestions.filter((a) => a.assetId !== s.assetId))}
                >
                  Remove suggestion
                </button>
              </article>
            ))}
          </div>
          <button
            type="button"
            className="primary"
            disabled={!ready || !current || !selection}
            onClick={save}
          >
            Save location note
          </button>
          {saved ? <p role="status">{saved}</p> : null}
          <hr />
          <h3>Whole neighborhood review</h3>
          <p>Approve once for this scene. Individual notes remain independently tracked.</p>
          <div className="preview-controls">
            <button type="button" disabled={!ready || !current} onClick={() => vote("approved")}>
              Approve neighborhood ✓
            </button>
            <button type="button" disabled={!ready || !current} onClick={() => vote("changes")}>
              Scene needs changes ✕
            </button>
          </div>
          {candidate.exploreUrl ? (
            <Link className="button" to={candidate.exploreUrl}>
              Explore / play this neighborhood →
            </Link>
          ) : null}
          <Link to="/tool/outdoor">Outdoor asset catalog →</Link>
          <details>
            <summary>Earlier crop decisions</summary>
            <Link to={`/review/${encodeURIComponent(candidate.id)}?show=all`}>
              Open original review history →
            </Link>
          </details>
        </aside>
      </div>
      {picker && outdoor ? (
        <section className="asset-picker">
          <h2>Suggest assets for this area</h2>
          <p>
            Select thumbnails to attach them. This records a suggestion; it does not place or
            promote artwork.
          </p>
          <OutdoorAssetBrowser
            assets={catalogAssets(outdoor.catalog, notes)}
            image={outdoor.image}
            initialSetting="square"
            onSelect={(a) => void suggest(a)}
          />
          <button type="button" onClick={() => setPicker(false)}>
            Done choosing props
          </button>
        </section>
      ) : null}
      <h2>Scene comments & earlier feedback</h2>
      <label>
        <input
          type="checkbox"
          checked={showResolved}
          onChange={(e) => setShowResolved(e.target.checked)}
        />{" "}
        Show resolved comments and earlier approvals
      </label>
      <div className="scene-notes">
        {visibleComments.map((n) => (
          <article key={n.threadId}>
            <div className="card-top">
              <strong>
                {n.status}
                {n.sceneAnnotation && n.sceneAnnotation.renderFingerprint !== candidate.fingerprint
                  ? " · earlier appearance"
                  : ""}
              </strong>
              {n.sceneAnnotation ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelection(n.sceneAnnotation!.rect);
                    setSuggestions(n.sceneAnnotation!.suggestions);
                    focusRect(n.sceneAnnotation!.rect, n.threadId);
                  }}
                >
                  Locate comment
                </button>
              ) : n.buildingReview?.caseId ? (
                <button type="button" onClick={() => shortcut(n.buildingReview!.caseId!)}>
                  Zoom to earlier view
                </button>
              ) : null}
            </div>
            <p className="user-text">{n.note}</p>
            {n.reply ? <blockquote>{n.reply}</blockquote> : null}
            {n.sceneAnnotation?.suggestions.map((s) => (
              <Link key={s.assetId} className="tag" to={`/tool/outdoor?rect=${s.rect.join(",")}`}>
                {s.metadata.name}
              </Link>
            ))}
            <Link to={threadPath(`art:${n.threadId}`)}>Open thread / update status →</Link>
          </article>
        ))}
      </div>
      {!visibleComments.length ? <p>No open comments for this neighborhood.</p> : null}
    </section>
  );
}
function inboxCaseBatch(caseId: string) {
  return caseId.startsWith("district-v10-")
    ? "pedestrians"
    : caseId.startsWith("district-v9-")
      ? "architecture"
      : caseId.startsWith("district-v8-")
        ? "parks"
        : caseId.startsWith("district-v7-")
          ? "parking"
          : caseId.startsWith("district-v2-")
            ? "commercial"
            : caseId.startsWith("district-v1-")
              ? "districts"
              : "";
}
