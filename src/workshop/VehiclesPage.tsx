import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { required } from "../art/ArtCatalog.js";
import type { ArtNote } from "../art/ArtNotes.js";
import type { OutdoorMetadata } from "../assets/outdoor/OutdoorCatalog.js";
import {
  VEHICLE_DIRECTIONS,
  VEHICLE_SOURCE,
  VEHICLE_VIEWS,
  validateVehicleGeometry,
} from "../assets/vehicles/VehicleCatalog.js";
import { drawVehicleDiagram } from "../assets/vehicles/VehicleDiagram.js";
import { ErrorMessage } from "./App.js";
import { AssetThumbnail } from "./OutdoorAssetBrowser.js";
import { OutdoorGeometryTest } from "./OutdoorGeometryTest.js";
import { useArtNotes, useOutdoorCatalog } from "./OutdoorQueries.js";
import { buildVehicleCandidate } from "./VehicleCandidates.js";
import { candidateSummary } from "./WorkshopProjection.js";
import { useManifest } from "./WorkshopQueries.js";
import type { CandidateSummary, WorkshopCandidate, WorkshopEvent } from "./WorkshopTypes.js";
import { type ReviewQueue, useWorkspace } from "./WorkspaceStore.js";

const emptyQueue: ReviewQueue = { filter: "unchecked", selected: "", paused: false, batch: [] };
function lastReview(c: WorkshopCandidate, notes: ArtNote[]) {
  return notes
    .filter(
      (n) =>
        n.assetAnnotation?.candidateId === c.id &&
        n.assetAnnotation.candidateFingerprint === c.fingerprint &&
        n.fingerprint === c.sourceFingerprint,
    )
    .sort((a, b) =>
      (a.assetAnnotation?.createdAt ?? "").localeCompare(b.assetAnnotation?.createdAt ?? ""),
    )
    .at(-1);
}
export default function VehiclesPage() {
  const manifest = useManifest(),
    art = useOutdoorCatalog(),
    notes = useArtNotes(),
    location = useLocation(),
    navigate = useNavigate();
  const outbox = useWorkspace((s) => s.outbox),
    queue = useWorkspace((s) => s.queues.vehicles) ?? emptyQueue;
  const candidates = manifest.data?.candidates.filter((c) => c.kind === "vehicle") ?? [];
  const rows = candidates.map((c) => {
    const state = candidateSummary(c, notes.data ?? [], [], manifest.data?.current);
    const pending = outbox
      .filter(
        (e): e is Extract<WorkshopEvent, { type: "asset" }> =>
          e.type === "asset" && e.candidateId === c.id && e.catalogRevision === c.fingerprint,
      )
      .at(-1);
    return pending
      ? { ...state, state: pending.verdict === "note" ? ("unchecked" as const) : pending.verdict }
      : state;
  });
  const visible = rows.filter(
    (c) =>
      queue.filter === "all" ||
      (queue.filter === "unchecked"
        ? ["unchecked", "changed"].includes(c.state)
        : c.state === queue.filter),
  );
  const selectedId = new URLSearchParams(location.search).get("view") ?? queue.selected;
  const selected = rows.find((c) => c.id === selectedId) ?? visible[0] ?? rows[0];
  function select(c: WorkshopCandidate) {
    useWorkspace.getState().setQueue("vehicles", { ...queue, selected: c.id });
    navigate(`/tool/vehicles?view=${encodeURIComponent(c.id)}`);
  }
  if (!manifest.data || !art.data || !notes.data)
    return <ErrorMessage error={manifest.error ?? art.error ?? notes.error} />;
  if (art.data.catalog.sourceFingerprint !== VEHICLE_SOURCE.sha256)
    return <p role="alert">Vehicle source changed. Rebuild the candidates before reviewing.</p>;
  if (!selected?.vehicle)
    return <p role="alert">Vehicle candidates are unavailable. Rebuild the Workshop manifest.</p>;
  const currentIndex = visible.findIndex((c) => c.id === selected.id);
  const vehicleIds = [...new Set(rows.map((c) => c.vehicle?.vehicleId))];
  const related = rows.filter((c) => c.vehicle?.vehicleId === selected.vehicle?.vehicleId);
  const latest = lastReview(selected, notes.data);
  const pending = outbox
    .filter(
      (e): e is Extract<WorkshopEvent, { type: "asset" }> =>
        e.type === "asset" &&
        e.candidateId === selected.id &&
        e.catalogRevision === selected.fingerprint,
    )
    .at(-1);
  const baseline =
    pending?.metadata ?? latest?.assetAnnotation?.metadata ?? selected.vehicle.asset.metadata;
  function afterSave(event: Extract<WorkshopEvent, { type: "asset" }>) {
    if (!selected) return false;
    let next = { ...queue };
    if (event.verdict === "changes") {
      const reports = [
        ...queue.batch.filter((r) => r.id !== selected?.id),
        { id: selected.id, fingerprint: selected.fingerprint, eventId: event.id, note: event.note },
      ];
      next = { ...next, batch: reports, paused: reports.length >= 2 };
    }
    if (event.verdict !== "note" && !next.paused) {
      const remaining = visible.filter((c) => c.id !== selected?.id);
      const target = remaining[Math.max(0, currentIndex) % Math.max(1, remaining.length)];
      if (target) {
        next.selected = target.id;
        navigate(`/tool/vehicles?view=${encodeURIComponent(target.id)}`);
      }
    }
    useWorkspace.getState().setQueue("vehicles", next);
    return event.verdict !== "note" && !!next.selected && next.selected !== selected.id;
  }
  return (
    <section className="vehicles-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SPRITES / GROUND BOUNDS / HEIGHT</p>
          <h1>Vehicles</h1>
          <p>
            Review each direction. Adjust the proposed ground box and physical height, then walk
            around it.
          </p>
        </div>
      </div>
      <p role="status">
        {rows.filter((c) => c.state === "approved").length} / {rows.length} views approved ·{" "}
        {vehicleIds.length} vehicle sets
      </p>
      {!manifest.data.current ? (
        <p role="alert">Review inputs changed. Rebuild the Workshop manifest before saving.</p>
      ) : null}
      <div className="vehicle-navigation">
        <label>
          Vehicle
          <select
            aria-label="Vehicle"
            value={selected.vehicle.vehicleId}
            onChange={(e) => {
              const c = rows.find(
                (c) =>
                  c.vehicle?.vehicleId === e.target.value &&
                  c.vehicle.direction === selected.vehicle?.direction,
              );
              if (c) select(c);
            }}
          >
            {vehicleIds.map((id) => {
              const c = rows.find((c) => c.vehicle?.vehicleId === id);
              return (
                <option key={id} value={id}>
                  {c?.vehicle?.name} (
                  {rows.filter((c) => c.vehicle?.vehicleId === id && c.state === "approved").length}
                  /4)
                </option>
              );
            })}
          </select>
        </label>
        <label>
          Show
          <select
            aria-label="Vehicle review filter"
            value={queue.filter}
            onChange={(e) =>
              useWorkspace
                .getState()
                .setQueue("vehicles", { ...queue, filter: e.target.value as ReviewQueue["filter"] })
            }
          >
            <option value="unchecked">Unchecked</option>
            <option value="all">All views</option>
            <option value="approved">Approved</option>
            <option value="changes">Needs changes</option>
          </select>
        </label>
        <button
          type="button"
          disabled={!visible.length}
          onClick={() => {
            const c = visible[(currentIndex - 1 + visible.length) % visible.length];
            if (c) select(c);
          }}
        >
          ← Previous view
        </button>
        <button
          type="button"
          disabled={!visible.length}
          onClick={() => {
            const c = visible[(currentIndex + 1) % visible.length];
            if (c) select(c);
          }}
        >
          Next view →
        </button>
      </div>
      {!visible.length ? (
        <p className="notice">
          No views remain in this filter. Choose another vehicle or show all views.
        </p>
      ) : null}
      {queue.paused ? (
        <div className="notice" role="status">
          <h2>Review paused after two Needs changes reports</h2>
          {queue.batch.map((r) => (
            <p key={r.eventId}>{r.note}</p>
          ))}
          <p>Ask for fixes when you’re ready, or continue reviewing another batch.</p>
          <button
            type="button"
            onClick={() =>
              useWorkspace.getState().setQueue("vehicles", { ...queue, paused: false, batch: [] })
            }
          >
            Keep reviewing
          </button>
        </div>
      ) : null}
      <fieldset className="vehicle-directions">
        <legend>Vehicle directions</legend>
        {VEHICLE_DIRECTIONS.map((direction) => {
          const c = related.find((c) => c.vehicle?.direction === direction);
          return c?.vehicle ? (
            <button
              type="button"
              key={direction}
              aria-pressed={c.id === selected.id}
              onClick={() => select(c)}
            >
              <AssetThumbnail asset={c.vehicle.asset} image={art.data.image} />
              <strong>{direction}</strong>
              <span>{c.state}</span>
            </button>
          ) : null;
        })}
      </fieldset>
      <VehicleInspector
        key={`${selected.id}:${selected.fingerprint}`}
        candidate={selected}
        image={art.data.image}
        baseline={baseline}
        review={latest}
        current={manifest.data.current}
        paused={queue.paused}
        afterSave={afterSave}
      />
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </label>
  );
}
function VehicleInspector({
  candidate: c,
  image,
  baseline,
  review,
  current,
  paused,
  afterSave,
}: {
  candidate: CandidateSummary;
  image: HTMLImageElement;
  baseline: OutdoorMetadata;
  review: ArtNote | undefined;
  current: boolean;
  paused: boolean;
  afterSave: (e: Extract<WorkshopEvent, { type: "asset" }>) => boolean;
}) {
  const view = required(c.vehicle);
  const key = `vehicle:${c.id}:${c.fingerprint}`;
  const [metadata, setMetadata] = useState<OutdoorMetadata>(() => {
    try {
      return validateVehicleGeometry(
        JSON.parse(useWorkspace.getState().drafts[key] ?? "null"),
        view.asset.rect,
      );
    } catch {
      return baseline;
    }
  });
  const [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [saved, setSaved] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const drafts = useWorkspace((s) => s.drafts),
    note = drafts[`note:${key}`] ?? "";
  useEffect(() => {
    useWorkspace.getState().setDraft(key, JSON.stringify(metadata));
  }, [key, metadata]);
  useEffect(() => {
    if (canvas.current) drawVehicleDiagram(canvas.current, image, view.asset, metadata);
  }, [image, view, metadata]);
  useEffect(() => {
    let active = true;
    const definition = VEHICLE_VIEWS.find((v) => v.id === c.id);
    setReady(false);
    if (!definition) return;
    void buildVehicleCandidate(document.createElement("canvas"), image, definition)
      .then((actual) => {
        if (actual.fingerprint !== c.fingerprint)
          throw new Error("Vehicle appearance changed. Rebuild the Workshop manifest.");
        if (active) setReady(true);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, [c.id, c.fingerprint, image]);
  function update(patch: Partial<OutdoorMetadata>) {
    setMetadata({ ...metadata, ...patch });
    setSaved("");
  }
  const box = required(metadata.footprint);
  const collider = required(metadata.colliders?.[0]);
  function ground(i: number, n: number) {
    const next = [...box] as [number, number, number, number];
    next[i] = n;
    update({
      footprint: next,
      colliders: [
        {
          ...collider,
          offsetX: next[0] + next[2] / 2,
          offsetY: next[1] + next[3],
          width: next[2],
          height: next[3],
        },
      ],
    });
  }
  function save(verdict: "note" | "approved" | "changes") {
    try {
      if (!ready || !current || paused) throw new Error("This view is not ready for review.");
      if (verdict === "changes" && !note.trim())
        throw new Error("Leave a reason for Needs changes.");
      const checked = validateVehicleGeometry(metadata, view.asset.rect);
      const event: Extract<WorkshopEvent, { type: "asset" }> = {
        id: crypto.randomUUID(),
        type: "asset",
        candidateId: c.id,
        rect: view.asset.rect,
        fingerprint: VEHICLE_SOURCE.sha256,
        catalogRevision: c.fingerprint,
        metadata: checked,
        verdict,
        note,
      };
      useWorkspace.getState().enqueue(event);
      useWorkspace.getState().setDraft(`note:${key}`, "");
      setSaved("Exact sprite and geometry queued for shared save.");
      setError("");
      if (afterSave(event)) setReady(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  const edited = JSON.stringify(metadata) !== JSON.stringify(baseline);
  return (
    <>
      <h2>
        {view.name} · {view.direction}
      </h2>
      <p>{view.guidance}</p>
      <p className="notice compact">
        {edited ? "Unsaved geometry changes" : c.state} · Proposed geometry stays in review until
        explicitly promoted to the game.
      </p>
      <div className="vehicle-review-layout">
        <div className="vehicle-preview">
          <canvas ref={canvas} aria-label="Vehicle geometry diagram" data-ready={ready} />
          <p>
            Blue: sprite crop · red/green: ground box · pink: physical height above the ground ·
            yellow: anchor · purple: depth sorting. Grid: one tile (16 px).
          </p>
          <OutdoorGeometryTest asset={view.asset} metadata={metadata} image={image} />
        </div>
        <aside className="vehicle-editor">
          <h3>Ground bounding box</h3>
          <p>
            Width runs left/right; depth runs up/down on the road. X and Y are relative to the
            yellow anchor.
          </p>
          <div className="vehicle-fields">
            {["Ground X", "Ground Y", "Ground width", "Ground depth"].map((label, i) => (
              <NumberField
                key={label}
                label={label}
                value={required(box[i])}
                onChange={(n) => ground(i, n)}
              />
            ))}
          </div>
          <NumberField
            label="Physical height"
            value={required(collider.zHeight)}
            onChange={(n) => update({ colliders: [{ ...collider, zHeight: n }] })}
          />
          <p>
            Height is above the road, not the sprite’s image height. A tile is 16 px; the test
            walker is 24 px tall.
          </p>
          <details>
            <summary>Anchor & depth sorting</summary>
            <div className="vehicle-fields">
              <NumberField
                label="Anchor X"
                value={metadata.anchor[0]}
                onChange={(n) => update({ anchor: [n, metadata.anchor[1]] })}
              />
              <NumberField
                label="Anchor Y"
                value={metadata.anchor[1]}
                onChange={(n) => update({ anchor: [metadata.anchor[0], n] })}
              />
              <NumberField
                label="Depth offset"
                value={metadata.depthOffset}
                onChange={(n) => update({ depthOffset: n })}
              />
            </div>
          </details>
          <label>
            Feedback
            <textarea
              aria-label="Vehicle feedback"
              value={note}
              maxLength={3500}
              onChange={(e) => useWorkspace.getState().setDraft(`note:${key}`, e.target.value)}
            />
          </label>
          <div className="vehicle-actions">
            <button
              type="button"
              className="primary"
              disabled={!ready || !current || paused}
              onClick={() => save("approved")}
            >
              Approve view →
            </button>
            <button
              type="button"
              disabled={!ready || !current || paused}
              onClick={() => save("changes")}
            >
              Needs changes ✕
            </button>
            <button
              type="button"
              disabled={!ready || !current || paused}
              onClick={() => save("note")}
            >
              Save geometry / reopen
            </button>
            <button
              type="button"
              onClick={() => {
                setMetadata(view.asset.metadata);
                setSaved("");
              }}
            >
              Reset to proposal
            </button>
          </div>
          <ErrorMessage error={error} />
          {saved ? <p role="status">{saved}</p> : null}
          {review?.assetAnnotation ? (
            <p>
              Last saved: {review.assetAnnotation.verdict} · {review.assetAnnotation.createdAt}
              <br />
              {review.note}
            </p>
          ) : null}
          <Link to={`/tool/art?sheet=me-complete&rect=${view.sourceRect.join(",")}`}>
            Inspect original source →
          </Link>
        </aside>
      </div>
    </>
  );
}
