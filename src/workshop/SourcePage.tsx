import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  type ArtCatalog,
  type ArtRect,
  inflateSlices,
  intersects,
  required,
  snapRegion,
  validateRect,
} from "../art/ArtCatalog.js";
import { ART_INTENTS, type ArtNote } from "../art/ArtNotes.js";
import { loadVerifiedArtImage } from "../art/ArtSource.js";
import { ErrorMessage, threadPath } from "./App.js";
import { workshopJson } from "./AuthClient.js";
import { useOutdoorCatalog } from "./OutdoorQueries.js";
import { useSession } from "./WorkshopQueries.js";
import { legacyValue, useWorkspace } from "./WorkspaceStore.js";

export default function SourcePage() {
  const catalog = useQuery({
    queryKey: ["art-catalog"],
    queryFn: async () => {
      const response = await fetch("/tilefun/data/art-catalog.json");
      if (!response.ok) throw new Error("Art inventory unavailable");
      return response.json() as Promise<ArtCatalog>;
    },
  });
  if (!catalog.data) return <ErrorMessage error={catalog.error} />;
  return <SourceBrowser catalog={catalog.data} />;
}
function SourceBrowser({ catalog }: { catalog: ArtCatalog }) {
  const outdoor = useOutdoorCatalog();
  const location = useLocation(),
    navigate = useNavigate(),
    session = useSession(),
    canvas = useRef<HTMLCanvasElement>(null),
    stage = useRef<HTMLDivElement>(null),
    crop = useRef<HTMLCanvasElement>(null);
  const params = new URLSearchParams(location.search),
    stored = useRef(legacyValue("tilefun.art-workbench.v1")).current;
  const sheet = required(
    catalog.sheets.find((s) => s.id === params.get("sheet")) ??
      catalog.sheets.find((s) => s.id === stored.sheetId) ??
      catalog.sheets.find((s) => s.id === "me-complete") ??
      catalog.sheets[0],
  );
  const [selection, setSelection] = useState<ArtRect | null>(null),
    [coverage, setCoverage] = useState(params.get("coverage") === "gaps"),
    [search, setSearch] = useState(params.get("q") ?? ""),
    [filter, setFilter] = useState(params.get("filter") ?? "all"),
    [intent, setIntent] = useState<ArtNote["intent"]>("other"),
    [view, setView] = useState({ x: 0, y: 0, zoom: 1 }),
    [mode, setMode] = useState("select"),
    [shiftHeld, setShiftHeld] = useState(false),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false),
    [saved, setSaved] = useState(false),
    [viewSize, setViewSize] = useState({ width: 0, height: 560 });
  // Store the world point at the viewport center. Zoom never changes this point.
  const { zoom } = view,
    camera = view,
    positionedTarget = useRef(""),
    localTarget = useRef<string | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    clientX: number;
    clientY: number;
    camera: { x: number; y: number };
    zoom: number;
    pan: boolean;
    pointerId: number;
  } | null>(null);
  const draftKey = `source:${sheet.id}`,
    drafts = useWorkspace((s) => s.drafts),
    draft = drafts[draftKey] ?? "";
  const image = useQuery({
    queryKey: ["source-image", sheet.id, sheet.fingerprint],
    queryFn: () => loadVerifiedArtImage(sheet),
    staleTime: Infinity,
  });
  const index = useQuery({
    queryKey: ["source-index", sheet.id, sheet.index],
    queryFn: async () => {
      const response = await fetch(required(sheet.index));
      if (!response.ok) throw new Error("Slice index unavailable");
      return inflateSlices(sheet, await response.json());
    },
    enabled: !!sheet.index,
    staleTime: Infinity,
  });
  const notes = useQuery({
    queryKey: ["workshop", "art-notes"],
    queryFn: () => workshopJson<ArtNote[]>("art-notes"),
    enabled: session.data?.authenticated === true,
    refetchInterval: 30_000,
  });
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const stop = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientHeight : 1;
      if (event.shiftKey && !event.ctrlKey) {
        drag.current = null;
        setView((old) => ({
          ...old,
          x: old.x + (event.deltaX * unit) / old.zoom,
          y: old.y + (event.deltaY * unit) / old.zoom,
        }));
        return;
      }
      const delta = Math.max(-200, Math.min(200, (event.deltaY || event.deltaX) * unit));
      if (!delta) return;
      // Unmodified wheel gestures only change scale, including horizontal jitter.
      drag.current = null;
      setView((old) => ({
        ...old,
        zoom: Math.max(0.03, Math.min(16, old.zoom * Math.exp(-delta * 0.003))),
      }));
    };
    node.addEventListener("wheel", stop, { passive: false });
    return () => node.removeEventListener("wheel", stop);
  }, []);
  useEffect(() => {
    const shift = (event: KeyboardEvent) => {
      if (event.key === "Shift") setShiftHeld(event.shiftKey);
    };
    const blur = () => setShiftHeld(false);
    window.addEventListener("keydown", shift);
    window.addEventListener("keyup", shift);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", shift);
      window.removeEventListener("keyup", shift);
      window.removeEventListener("blur", blur);
    };
  }, []);
  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver((entries) => {
      const width = Math.max(240, Math.round(entries[0]?.contentRect.width ?? 800));
      setViewSize({ width, height: window.innerWidth < 700 ? 430 : 560 });
    });
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!viewSize.width) return;
    const p = new URLSearchParams(location.search),
      raw = p.get("rect");
    let rect: ArtRect | null = null;
    try {
      if (raw) rect = validateRect(raw.split(",").map(Number), sheet);
      else if (!p.has("view") && stored.sheetId === sheet.id && stored.selection)
        rect = validateRect(stored.selection, sheet);
    } catch {
      setError("The saved selection no longer fits this sheet.");
    }
    const savedIntent =
      useWorkspace.getState().drafts[`intent:${draftKey}`] ??
      (stored.sheetId === sheet.id ? stored.intent : "other");
    setIntent(
      ART_INTENTS.includes(savedIntent as ArtNote["intent"])
        ? (savedIntent as ArtNote["intent"])
        : "other",
    );
    setSelection(rect);
    setSearch(p.get("q") ?? "");
    setFilter(p.get("filter") ?? "all");
    setCopied(false);
    setSaved(false);
    const target = `${sheet.id}:${rect?.join(",") ?? "sheet"}`;
    if (positionedTarget.current !== target) {
      const preserveView = localTarget.current === target;
      positionedTarget.current = target;
      localTarget.current = null;
      if (!preserveView) {
        const zoom = rect
          ? Math.max(
              0.03,
              Math.min(4, (viewSize.width - 64) / rect[2], (viewSize.height - 64) / rect[3]),
            )
          : viewSize.width / sheet.width;
        setView({
          zoom,
          x: rect ? rect[0] + rect[2] / 2 : sheet.width / 2,
          y: rect ? rect[1] + rect[3] / 2 : viewSize.height / (2 * zoom),
        });
      }
    }
    if (useWorkspace.getState().drafts[draftKey] === undefined)
      useWorkspace
        .getState()
        .setDraft(
          draftKey,
          stored.sheetId === sheet.id && typeof stored.note === "string" ? stored.note : "",
        );
  }, [sheet, stored, draftKey, location.search, viewSize]);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !canvas.current) return;
    canvas.current.width = viewSize.width;
    canvas.current.height = viewSize.height;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#c9cec5";
    ctx.fillRect(0, 0, viewSize.width, viewSize.height);
    const left = camera.x - viewSize.width / (2 * zoom),
      top = camera.y - viewSize.height / (2 * zoom);
    if (image.data)
      ctx.drawImage(image.data, -left * zoom, -top * zoom, sheet.width * zoom, sheet.height * zoom);
    if (selection) {
      ctx.fillStyle = "#f4ba4233";
      ctx.fillRect(
        (selection[0] - left) * zoom,
        (selection[1] - top) * zoom,
        selection[2] * zoom,
        selection[3] * zoom,
      );
      ctx.strokeStyle = "#f5b83e";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        (selection[0] - left) * zoom,
        (selection[1] - top) * zoom,
        selection[2] * zoom,
        selection[3] * zoom,
      );
    }
    if (coverage && sheet.id === "me-complete" && outdoor.data) {
      ctx.fillStyle = "#ed416055";
      for (const r of outdoor.data.catalog.coverage.gaps) {
        if (
          r[0] + r[2] < left ||
          r[1] + r[3] < top ||
          r[0] > left + viewSize.width / zoom ||
          r[1] > top + viewSize.height / zoom
        )
          continue;
        ctx.fillRect((r[0] - left) * zoom, (r[1] - top) * zoom, r[2] * zoom, r[3] * zoom);
      }
    }
  }, [image.data, sheet, selection, zoom, camera, viewSize, coverage, outdoor.data]);
  useEffect(() => {
    if (!crop.current || !selection || !image.data) return;
    const [x, y, w, h] = selection;
    crop.current.width = w;
    crop.current.height = h;
    const ctx = required(crop.current.getContext("2d"));
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(image.data, x, y, w, h, 0, 0, w, h);
  }, [image.data, selection]);
  function share(rect: ArtRect | null = selection) {
    const p = new URLSearchParams({ sheet: sheet.id });
    if (rect) p.set("rect", rect.join(","));
    else p.set("view", "sheet");
    if (search) p.set("q", search);
    if (filter !== "all") p.set("filter", filter);
    if (coverage) p.set("coverage", "gaps");
    return `/tool/art?${p}`;
  }
  function selectRect(rect: ArtRect) {
    setSelection(rect);
    setView({
      x: rect[0] + rect[2] / 2,
      y: rect[1] + rect[3] / 2,
      zoom: Math.max(
        0.03,
        Math.min(4, (viewSize.width - 64) / rect[2], (viewSize.height - 64) / rect[3]),
      ),
    });
    updateSelectionLink(rect);
  }
  function updateSelectionLink(rect: ArtRect | null) {
    const path = share(rect);
    // Publishing a local selection must not reposition the viewport.
    // Keep the last acknowledged route until React commits this navigation.
    // A resize during that transition must not refocus the old selection.
    localTarget.current = `${sheet.id}:${rect?.join(",") ?? "sheet"}`;
    navigate(path, { replace: true });
  }
  function zoomBy(factor: number) {
    drag.current = null;
    setView((old) => ({ ...old, zoom: Math.max(0.03, Math.min(16, old.zoom * factor)) }));
  }
  function setDraft(value: string) {
    useWorkspace.getState().setDraft(draftKey, value);
    setSaved(false);
    try {
      localStorage.setItem(
        "tilefun.art-workbench.v1",
        JSON.stringify({
          ...legacyValue("tilefun.art-workbench.v1"),
          sheetId: sheet.id,
          selection,
          note: value,
          intent,
        }),
      );
    } catch {
      /* The Workshop persisted copy remains available. */
    }
  }
  const allSlices = index.data ?? [],
    uses = catalog.usages.filter((u) => u.sheetId === sheet.id),
    selectedUses = selection ? uses.filter((u) => intersects(u.rect, selection)) : [],
    selectedSlices = selection ? allSlices.filter((s) => intersects(s.rect, selection)) : [];
  const filtered = allSlices.filter(
    (s) =>
      (!search || `${s.name} ${s.theme}`.toLowerCase().includes(search.toLowerCase())) &&
      (filter !== "uses" || uses.some((u) => intersects(u.rect, s.rect))),
  );
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(
        sheet.width - 1,
        Math.max(
          0,
          camera.x +
            (((event.clientX - r.left) * viewSize.width) / r.width - viewSize.width / 2) / zoom,
        ),
      ),
      y: Math.min(
        sheet.height - 1,
        Math.max(
          0,
          camera.y +
            (((event.clientY - r.top) * viewSize.height) / r.height - viewSize.height / 2) / zoom,
        ),
      ),
    };
  };
  function save() {
    if (!selection || !draft.trim()) {
      setError("Select source art and write a note first.");
      return;
    }
    if (!image.data) {
      setError("Wait for the source image to be verified.");
      return;
    }
    useWorkspace.getState().enqueue({
      id: crypto.randomUUID(),
      type: "source",
      sheetId: sheet.id,
      fingerprint: sheet.fingerprint,
      rect: selection,
      sliceKeys: selectedSlices.slice(0, 40).map((s) => s.key),
      intent,
      note: draft.trim(),
    });
    setDraft("");
    setSaved(true);
    setError("");
  }
  return (
    <section className="source-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SOURCE ART → ASSETS</p>
          <h1>Art workbench</h1>
          <p>Select tiles or regions, see their recorded uses, and leave a shared request.</p>
          <Link to="/tool/families?family=cabinets">Browse family sheets →</Link>
        </div>
        <a href={`/tilefun/art-workbench.html${location.search}`} target="_blank" rel="noreferrer">
          Original workbench ↗
        </a>
      </div>
      <div className="source-toolbar">
        <label>
          Sheet
          <select
            aria-label="Sheet"
            value={sheet.id}
            onChange={(e) =>
              navigate(`/tool/art?sheet=${encodeURIComponent(e.target.value)}&view=sheet`)
            }
          >
            {catalog.sheets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Search slices
          <input
            aria-label="Search slices"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Condo, hotel, sidewalk…"
          />
        </label>
        <label>
          Show
          <select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All indexed slices</option>
            <option value="indexed">Named slices</option>
            <option value="uses">Recorded uses</option>
          </select>
        </label>
      </div>
      <div className="source-layout">
        <div>
          <div className="source-stage" ref={stage}>
            <canvas
              ref={canvas}
              aria-label="Source spritesheet"
              aria-describedby="source-navigation-help"
              tabIndex={0}
              data-center-x={camera.x}
              data-center-y={camera.y}
              data-zoom={zoom}
              data-source-ready={!!image.data && viewSize.width > 0}
              style={{
                touchAction: "none",
                cursor: mode === "pan" || shiftHeld ? "grab" : "crosshair",
              }}
              onKeyDown={(event) => {
                if (event.ctrlKey || event.metaKey || event.altKey) return;
                const direction: Record<string, [number, number]> = {
                  ArrowLeft: [-1, 0],
                  ArrowRight: [1, 0],
                  ArrowUp: [0, -1],
                  ArrowDown: [0, 1],
                };
                const offset = direction[event.key];
                if (!offset) return;
                event.preventDefault();
                event.stopPropagation();
                drag.current = null;
                setView((old) => ({
                  ...old,
                  x: old.x + (offset[0] * 80 * (event.shiftKey ? 3 : 1)) / old.zoom,
                  y: old.y + (offset[1] * 80 * (event.shiftKey ? 3 : 1)) / old.zoom,
                }));
              }}
              onPointerDown={(event) => {
                if (event.button !== 0 && event.button !== 1) return;
                event.preventDefault();
                event.currentTarget.focus({ preventScroll: true });
                event.currentTarget.setPointerCapture(event.pointerId);
                const p = point(event),
                  pan = mode === "pan" || event.button === 1 || event.shiftKey;
                drag.current = {
                  ...p,
                  clientX: event.clientX,
                  clientY: event.clientY,
                  camera,
                  zoom,
                  pan,
                  pointerId: event.pointerId,
                };
                if (!pan) setSelection(snapRegion(p, p, sheet));
              }}
              onPointerMove={(event) => {
                const start = drag.current;
                if (!start || start.pointerId !== event.pointerId) return;
                if (start.pan) {
                  const bounds = event.currentTarget.getBoundingClientRect();
                  setView((old) => ({
                    ...old,
                    x:
                      start.camera.x -
                      ((event.clientX - start.clientX) * viewSize.width) /
                        bounds.width /
                        start.zoom,
                    y:
                      start.camera.y -
                      ((event.clientY - start.clientY) * viewSize.height) /
                        bounds.height /
                        start.zoom,
                  }));
                } else {
                  try {
                    setSelection(snapRegion(start, point(event), sheet));
                  } catch {
                    /* Ignore boundary movement. */
                  }
                }
              }}
              onPointerUp={(event) => {
                const start = drag.current;
                if (!start || start.pointerId !== event.pointerId) return;
                drag.current = null;
                if (!start.pan) {
                  const rect = snapRegion(start, point(event), sheet);
                  setSelection(rect);
                  updateSelectionLink(rect);
                }
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
              onLostPointerCapture={() => {
                drag.current = null;
              }}
            />
          </div>
          <div className="preview-controls">
            {sheet.id === "me-complete" ? (
              <label>
                <input
                  type="checkbox"
                  checked={coverage}
                  onChange={(e) => setCoverage(e.target.checked)}
                />{" "}
                Highlight atlas gaps
              </label>
            ) : null}
            <label>
              Tool
              <select aria-label="Tool" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="select">Select region</option>
                <option value="pan">Pan sheet</option>
              </select>
            </label>
            <button type="button" onClick={() => zoomBy(1.5)}>
              Zoom +
            </button>
            <button type="button" onClick={() => zoomBy(1 / 1.5)}>
              Zoom −
            </button>
            <button
              type="button"
              onClick={() => {
                const zoom = viewSize.width / sheet.width;
                setView({ x: sheet.width / 2, y: viewSize.height / (2 * zoom), zoom });
              }}
            >
              Fit width
            </button>
            <button
              type="button"
              onClick={() => {
                setSelection(null);
                updateSelectionLink(null);
              }}
            >
              Clear selection
            </button>
          </div>
          <p className="muted" id="source-navigation-help">
            {Math.round(zoom * 100)}% · Wheel or Zoom buttons keep the view center fixed. Hold Shift
            to pan with a drag or wheel. Middle-drag also pans. Click the sheet, then use arrow keys
            to pan; Shift + arrows moves faster.
          </p>
          {coverage && sheet.id === "me-complete" && outdoor.data ? (
            <p className="notice compact">
              Pink marks occupied cells without named slices.{" "}
              {outdoor.data.catalog.coverage.gapCells.toLocaleString()} gap cells remain; select a
              region to name it in the Outdoor catalog.{" "}
              <button
                type="button"
                onClick={() => {
                  const gaps = outdoor.data!.catalog.coverage.gaps;
                  const index = gaps.findIndex((r) => selection && r.join() === selection.join());
                  const next = gaps[(index + 1) % gaps.length];
                  if (next) selectRect(next);
                }}
              >
                Next unmapped region →
              </button>
            </p>
          ) : null}
          <p className="muted">
            {sheet.width} × {sheet.height} pixels · {allSlices.length} named slices · {uses.length}{" "}
            recorded uses
          </p>
          <ErrorMessage error={image.error ?? index.error ?? error} />
          <details className="slice-results" open={!!search}>
            <summary>Named slices ({filtered.length})</summary>
            <div>
              {filtered.slice(0, 100).map((s) => (
                <button type="button" key={s.key} onClick={() => selectRect(s.rect)}>
                  {s.name}
                  <small>
                    {s.theme} · {s.rect.join(", ")}
                  </small>
                </button>
              ))}
            </div>
            {filtered.length > 100 ? <p>Refine search to see more slices.</p> : null}
          </details>
        </div>
        <aside className="source-inspector">
          <h2>Your selection</h2>
          {selection ? (
            <>
              <code>{selection.join(", ")}</code>
              {sheet.id === "me-complete" ? (
                <Link className="button" to={`/tool/outdoor?rect=${selection.join(",")}`}>
                  Name / review this asset →
                </Link>
              ) : null}
              <div className="source-crop">
                <canvas ref={crop} aria-label="Selected source art" />
              </div>
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(`${window.location.origin}/tilefun/workshop.html#${share()}`)
                    .then(() => setCopied(true))
                    .catch(() =>
                      setError("Clipboard unavailable. Copy the current address instead."),
                    )
                }
              >
                {copied ? "Link copied" : "Copy selection link"}
              </button>
            </>
          ) : (
            <p>Tap a tile or drag a region in the sheet.</p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <label>
              Use / intent
              <select
                aria-label="Use / intent"
                value={intent}
                onChange={(e) => {
                  const value = e.target.value as ArtNote["intent"];
                  setIntent(value);
                  useWorkspace.getState().setDraft(`intent:${draftKey}`, value);
                  try {
                    localStorage.setItem(
                      "tilefun.art-workbench.v1",
                      JSON.stringify({
                        ...legacyValue("tilefun.art-workbench.v1"),
                        sheetId: sheet.id,
                        selection,
                        note: draft,
                        intent: value,
                      }),
                    );
                  } catch {
                    /* Workshop persisted copy */
                  }
                }}
              >
                {ART_INTENTS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Note
              <textarea
                aria-label="Note"
                value={draft}
                maxLength={3500}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="What could we make from these tiles?"
              />
            </label>
            <button
              type="submit"
              className="primary"
              disabled={!selection || !image.data || !session.data?.authenticated}
            >
              Save shared note
            </button>
            {!session.data?.authenticated ? (
              <Link to={`/login?returnTo=${encodeURIComponent("/tool/art" + location.search)}`}>
                Sign in to annotate →
              </Link>
            ) : null}
            {saved ? <p role="status">Note queued for the shared inbox.</p> : null}
          </form>
          <details open>
            <summary>Recorded uses ({selectedUses.length})</summary>
            {selectedUses.map((u) => (
              <article key={u.id}>
                <strong>{u.label}</strong>
                {u.id.startsWith("pattern:fenced-trees-v1:") ? (
                  <p>
                    <Link to="/tool/patterns?family=fenced-trees-v1">Draw this pattern →</Link>
                  </p>
                ) : null}
                <p>
                  {u.kind} · {u.consumers.map((c) => c.system).join(", ")}
                </p>
              </article>
            ))}
            {selection && !selectedUses.length ? (
              <p>No recorded use overlaps this selection.</p>
            ) : null}
          </details>
          <details>
            <summary>Named slices ({selectedSlices.length})</summary>
            {selectedSlices.slice(0, 30).map((s) => (
              <button type="button" key={s.key} onClick={() => selectRect(s.rect)}>
                {s.name}
              </button>
            ))}
          </details>
          <details open>
            <summary>Shared notes here</summary>
            {notes.data
              ?.filter(
                (n) =>
                  !n.sceneAnnotation &&
                  n.sheetId === sheet.id &&
                  (!selection || intersects(n.rect, selection)),
              )
              .slice(-12)
              .reverse()
              .map((n) => (
                <article key={n.threadId}>
                  <Link to={threadPath(`art:${n.threadId}`)}>
                    {n.status} · {n.note}
                  </Link>
                  {n.reply ? <p>{n.reply}</p> : null}
                </article>
              ))}
          </details>
        </aside>
      </div>
    </section>
  );
}
