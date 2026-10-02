import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { TerrainId } from "../autotile/TerrainId.js";
import {
  DocumentHistory,
  type GridPoint,
  type StrokeShape,
  strokeCells,
} from "../patterns/GridStroke.js";
import {
  applyPatternEdit,
  exampleDocument,
  familyDefinition,
  PATTERN_FAMILIES,
  type PatternDocument,
  type PatternEdit,
  type PatternFamily,
  parsePatternDocument,
  roomDraftWarning,
  roomSketch,
} from "../patterns/PatternDocument.js";
import { renderPatternDocument } from "../patterns/PatternRuntime.js";
import { RoadType } from "../road/RoadType.js";
import { ErrorMessage } from "./App.js";
import { loadReviewAtlas } from "./InteriorCandidates.js";
import { TREE_PATTERN_CASES, treeCaseDocument } from "./PatternCandidates.js";
import { reviewAssets } from "./ReviewAssets.js";
import "./patterns.css";

const STORAGE = "tilefun.pattern-drafts.v1";
function readDraft(family: PatternFamily): PatternDocument {
  try {
    const raw = JSON.parse(localStorage.getItem(`${STORAGE}:${family}`) ?? "null");
    if (raw) {
      const d = parsePatternDocument(raw);
      if (d.family === family) return d;
    }
  } catch {}
  return exampleDocument(family);
}
const palettes: Record<PatternFamily, { label: string; value: string | number }[]> = {
  "rooms-v1": [
    { label: "Living", value: "L" },
    { label: "Bedroom", value: "B" },
    { label: "Kitchen", value: "K" },
    { label: "Bath", value: "T" },
    { label: "Hall", value: "H" },
    { label: "Wall", value: "#" },
    { label: "Door", value: "+" },
  ],
  "fenced-trees-v1": [{ label: "Broadleaf + fence", value: 1 }],
  "terrain-v1": [
    { label: "Grass", value: TerrainId.Grass },
    { label: "Dirt", value: TerrainId.DirtWarm },
    { label: "Sand", value: TerrainId.Sand },
    { label: "Shallow water", value: TerrainId.ShallowWater },
    { label: "Deep water", value: TerrainId.DeepWater },
  ],
  "city-surfaces-v1": [
    { label: "City asphalt", value: RoadType.CityAsphalt },
    { label: "City pavement", value: RoadType.CityPavement },
  ],
};
export default function PatternPage() {
  const location = useLocation(),
    navigate = useNavigate();
  const requested = new URLSearchParams(location.search).get("family");
  const family = PATTERN_FAMILIES.find((f) => f.id === requested)?.id ?? "rooms-v1";
  return (
    <PatternStudio
      key={`${family}:${new URLSearchParams(location.search).get("case") ?? "draft"}`}
      family={family}
      caseId={new URLSearchParams(location.search).get("case")}
      select={(f) => navigate(`/tool/patterns?family=${f}`)}
    />
  );
}
function PatternStudio({
  family,
  select,
  caseId,
}: {
  family: PatternFamily;
  select: (f: PatternFamily) => void;
  caseId: string | null;
}) {
  const [initialHistory] = useState(
    () =>
      new DocumentHistory(
        caseId && family === "fenced-trees-v1" && TREE_PATTERN_CASES.some((c) => c.id === caseId)
          ? treeCaseDocument(caseId)
          : readDraft(family),
      ),
  );
  const history = useRef(initialHistory),
    canvas = useRef<HTMLCanvasElement>(null),
    container = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null);
  const [doc, setDoc] = useState(history.current.current),
    [revision, setRevision] = useState(0),
    [value, setValue] = useState<string | number>(palettes[family][0]?.value ?? 1),
    [erase, setErase] = useState(false),
    [shape, setShape] = useState<StrokeShape>(family === "rooms-v1" ? "rectangle" : "free"),
    [roomRectangle, setRoomRectangle] = useState(family === "rooms-v1"),
    [grid, setGrid] = useState(true),
    [geometry, setGeometry] = useState(false),
    [error, setError] = useState(""),
    [saveError, setSaveError] = useState(""),
    [preview, setPreview] = useState<PatternEdit | null>(null),
    [assets, setAssets] = useState<Awaited<ReturnType<typeof reviewAssets>> | null>(null),
    [atlas, setAtlas] = useState<HTMLImageElement | null>(null);
  const gridSize = familyDefinition(family).gridSize;
  const [view, setView] = useState({
      x: (doc.width * gridSize) / 2,
      y: (doc.height * gridSize) / 2,
      zoom: family === "rooms-v1" ? 1 : 2,
    }),
    [size, setSize] = useState({ width: 800, height: 560 });
  const initiallyFitted = useRef(false);
  const drag = useRef<{
    id: number;
    pan: boolean;
    startX: number;
    startY: number;
    view: typeof view;
    edit: PatternEdit | null;
  } | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([reviewAssets(), loadReviewAtlas()])
      .then(([a, b]) => {
        if (active) {
          setAssets(a);
          setAtlas(b);
        }
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE}:${family}`, JSON.stringify(doc));
      setSaveError("");
    } catch {
      setSaveError("Browser could not save this draft. Export JSON to keep your work.");
    }
  }, [doc, family]);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([e]) => {
      if (e) {
        setSize({
          width: Math.round(e.contentRect.width),
          height: Math.round(e.contentRect.height),
        });
        if (!initiallyFitted.current && e.contentRect.width > 0 && e.contentRect.height > 0) {
          initiallyFitted.current = true;
          setView((v) => ({
            ...v,
            zoom: Math.max(
              0.25,
              Math.min(
                v.zoom,
                e.contentRect.width / (doc.width * gridSize + 64),
                e.contentRect.height / (doc.height * gridSize + 64),
              ),
            ),
          }));
        }
      }
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [doc.width, doc.height, gridSize]);
  function changed() {
    setDoc(history.current.current);
    setRevision((r) => r + 1);
    setError("");
    setPreview(null);
  }
  function zoom(factor: number) {
    setView((v) => ({ ...v, zoom: Math.max(0.25, Math.min(8, v.zoom * factor)) }));
  }
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.shiftKey && !e.ctrlKey)
        setView((v) => ({ ...v, x: v.x + e.deltaX / v.zoom, y: v.y + e.deltaY / v.zoom }));
      else
        setView((v) => ({
          ...v,
          zoom: Math.max(
            0.25,
            Math.min(8, v.zoom * Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 0.006)),
          ),
        }));
    };
    c.addEventListener("wheel", wheel, { passive: false });
    return () => c.removeEventListener("wheel", wheel);
  }, []);
  useEffect(() => {
    if (!canvas.current || !assets || !atlas) return;
    const c = canvas.current;
    c.width = size.width;
    c.height = size.height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const rendered = document.createElement("canvas");
    let shown = doc,
      invalid = false;
    if (preview)
      try {
        shown = applyPatternEdit(doc, preview);
      } catch {
        invalid = true;
      }
    renderPatternDocument(rendered, shown, assets.assets, atlas, geometry);
    ctx.fillStyle = "#101914";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.translate(c.width / 2, c.height / 2);
    ctx.scale(view.zoom, view.zoom);
    ctx.translate(-view.x, -view.y);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(rendered, 0, 0);
    if (grid) {
      ctx.lineWidth = 1 / view.zoom;
      ctx.strokeStyle = "#b8cec02a";
      ctx.beginPath();
      for (let x = 0; x <= doc.width; x++) {
        ctx.moveTo(x * gridSize, 0);
        ctx.lineTo(x * gridSize, doc.height * gridSize);
      }
      for (let y = 0; y <= doc.height; y++) {
        ctx.moveTo(0, y * gridSize);
        ctx.lineTo(doc.width * gridSize, y * gridSize);
      }
      ctx.stroke();
    }
    if (preview) {
      ctx.fillStyle = invalid ? "#f5606050" : "#8bd1c02f";
      ctx.strokeStyle = invalid ? "#ff8080" : "#8bd1c0";
      ctx.lineWidth = 1 / view.zoom;
      try {
        for (const p of strokeCells(
          preview.path,
          family === "fenced-trees-v1" ? "horizontal" : preview.shape,
        )) {
          ctx.fillRect(p.x * gridSize, p.y * gridSize, gridSize, gridSize);
          ctx.strokeRect(p.x * gridSize, p.y * gridSize, gridSize, gridSize);
        }
      } catch {}
    }
    ctx.restore();
  }, [assets, atlas, doc, preview, geometry, grid, gridSize, view, size, family]);
  function point(e: { clientX: number; clientY: number }): GridPoint {
    const r = canvas.current?.getBoundingClientRect();
    return {
      x: Math.floor(
        ((e.clientX - (r?.left ?? 0) - size.width / 2) / view.zoom + view.x) / gridSize,
      ),
      y: Math.floor(
        ((e.clientY - (r?.top ?? 0) - size.height / 2) / view.zoom + view.y) / gridSize,
      ),
    };
  }
  function proposal(edit: PatternEdit) {
    setPreview(edit);
    try {
      applyPatternEdit(doc, edit);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  function end(cancel = false) {
    const d = drag.current;
    drag.current = null;
    if (!d?.edit || cancel) {
      setPreview(null);
      return;
    }
    try {
      history.current.commit(applyPatternEdit(doc, d.edit));
      changed();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPreview(null);
    }
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      const next = parsePatternDocument(JSON.parse(await file.text()));
      if (next.family !== family)
        throw new Error("Switch to the file's pattern family before importing.");
      history.current.commit(next);
      changed();
      setView((v) => ({ ...v, x: (next.width * gridSize) / 2, y: (next.height * gridSize) / 2 }));
    } catch (e) {
      setError(String(e));
    }
  }
  function exportFile() {
    const url = URL.createObjectURL(
      new Blob([`${JSON.stringify(doc, null, 2)}\n`], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${family}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="pattern-studio">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DRAW SEMANTIC PATTERNS</p>
          <h1>Pattern studio</h1>
          <Link to="/review/pattern%3Afenced-trees-v1-short">Fenced tree review queue →</Link>
          <p>
            Real tiles, shared rules. Drafts stay in this browser; export to move them between
            machines.
          </p>
        </div>
      </div>
      <div className="pattern-toolbar">
        <label>
          Family{" "}
          <select
            aria-label="Pattern family"
            value={family}
            onChange={(e) => select(e.target.value as PatternFamily)}
          >
            {PATTERN_FAMILIES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Brush{" "}
          <select
            aria-label="Pattern brush"
            value={value}
            onChange={(e) => {
              const v =
                palettes[family].find((p) => String(p.value) === e.target.value)?.value ?? 1;
              setValue(v);
              setErase(false);
              if (family === "rooms-v1" && (v === "#" || v === "+")) {
                setRoomRectangle(false);
                setShape("free");
              }
            }}
          >
            {palettes[family].map((p) => (
              <option key={p.label} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {family === "rooms-v1" ? (
          <label>
            Operation{" "}
            <select
              aria-label="Room operation"
              value={roomRectangle ? "room" : shape}
              onChange={(e) => {
                setRoomRectangle(e.target.value === "room");
                setShape(e.target.value === "room" ? "rectangle" : (e.target.value as StrokeShape));
                if (e.target.value === "room") setValue("L");
              }}
            >
              <option value="room">Room rectangle</option>
              <option value="free">Paint / partition</option>
              <option value="rectangle">Fill rectangle</option>
            </select>
          </label>
        ) : family !== "fenced-trees-v1" ? (
          <label>
            Shape{" "}
            <select
              aria-label="Stroke shape"
              value={shape}
              onChange={(e) => setShape(e.target.value as StrokeShape)}
            >
              <option value="free">Brush</option>
              <option value="rectangle">Rectangle</option>
            </select>
          </label>
        ) : null}
        <button type="button" aria-pressed={erase} onClick={() => setErase(!erase)}>
          Erase
        </button>
        <button
          type="button"
          disabled={!history.current.canUndo}
          onClick={() => {
            history.current.undo();
            changed();
          }}
        >
          Undo
        </button>
        <button
          type="button"
          disabled={!history.current.canRedo}
          onClick={() => {
            history.current.redo();
            changed();
          }}
        >
          Redo
        </button>
        <button
          type="button"
          onClick={() => {
            history.current.commit(exampleDocument(family));
            changed();
          }}
        >
          Reset example
        </button>
        <button
          type="button"
          onClick={() => {
            history.current.commit({ ...doc, cells: [] });
            changed();
          }}
        >
          Clear draft
        </button>
        <button type="button" onClick={exportFile}>
          Export JSON
        </button>
        <button type="button" onClick={() => input.current?.click()}>
          Import JSON
        </button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            void importFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      <div className="pattern-toolbar">
        <button type="button" onClick={() => zoom(1 / 1.25)} aria-label="Zoom out">
          −
        </button>
        <output>{view.zoom.toFixed(2)}×</output>
        <button type="button" onClick={() => zoom(1.25)} aria-label="Zoom in">
          +
        </button>
        <button
          type="button"
          onClick={() =>
            setView({
              x: (doc.width * gridSize) / 2,
              y: (doc.height * gridSize) / 2,
              zoom: Math.max(
                0.25,
                Math.min(
                  size.width / (doc.width * gridSize + 64),
                  size.height / (doc.height * gridSize + 64),
                ),
              ),
            })
          }
        >
          Fit
        </button>
        <label>
          <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} /> Grid
        </label>
        <label>
          <input
            type="checkbox"
            checked={geometry}
            onChange={(e) => setGeometry(e.target.checked)}
          />{" "}
          Geometry
        </label>
        <span>Wheel: center zoom · Shift or middle drag: pan · arrows: pan · Ctrl/Cmd Z: undo</span>
      </div>
      <div className="pattern-notice">
        <ErrorMessage error={error || saveError} />
      </div>
      <div className="pattern-canvas-frame" ref={container}>
        <canvas
          ref={canvas}
          aria-label="Pattern drawing canvas"
          data-testid="pattern-canvas"
          data-ready={!!assets && !!atlas}
          data-center-x={view.x}
          data-center-y={view.y}
          data-zoom={view.zoom}
          data-semantic-cells={doc.cells.length}
          tabIndex={0}
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => {
            if (drag.current || !assets || !atlas || ![0, 1, 2].includes(e.button)) return;
            e.preventDefault();
            e.currentTarget.focus();
            e.currentTarget.setPointerCapture(e.pointerId);
            const pan = e.button === 1 || e.shiftKey;
            const edit = pan
              ? null
              : {
                  path: [point(e)],
                  shape,
                  value,
                  erase: erase || e.button === 2,
                  roomRectangle: roomRectangle && family === "rooms-v1",
                };
            drag.current = {
              id: e.pointerId,
              pan,
              startX: e.clientX,
              startY: e.clientY,
              view,
              edit,
            };
            if (edit) proposal(edit);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || d.id !== e.pointerId) return;
            if (d.pan) {
              setView({
                ...d.view,
                x: d.view.x - (e.clientX - d.startX) / d.view.zoom,
                y: d.view.y - (e.clientY - d.startY) / d.view.zoom,
              });
              return;
            }
            if (!d.edit) return;
            const p = point(e),
              last = d.edit.path.at(-1);
            if (last?.x === p.x && last.y === p.y) return;
            d.edit = {
              ...d.edit,
              path:
                d.edit.shape === "free" && family !== "fenced-trees-v1"
                  ? [...d.edit.path, p]
                  : [d.edit.path[0] ?? p, p],
            };
            proposal(d.edit);
          }}
          onPointerUp={(e) => {
            if (drag.current?.id === e.pointerId) {
              end();
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
          }}
          onPointerCancel={() => end(true)}
          onLostPointerCapture={() => end(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              end(true);
              e.preventDefault();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
              e.preventDefault();
              if (e.shiftKey) history.current.redo();
              else history.current.undo();
              changed();
            } else if (e.key.startsWith("Arrow")) {
              e.preventDefault();
              const step = (e.shiftKey ? 120 : 40) / view.zoom;
              setView((v) => ({
                ...v,
                x: v.x + (e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0),
                y: v.y + (e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0),
              }));
            }
          }}
        />
      </div>
      <p role="status" data-testid="pattern-status">
        {assets && atlas
          ? `${doc.cells.length} semantic cells · ${familyDefinition(family).backend} · draft ${revision}`
          : "Loading source art…"}
      </p>
      {family === "fenced-trees-v1" ? (
        <p>
          Candidate kit: E/W only; fence south. Drag at least four cells. Erasing a middle section
          must leave supported ends (four cells each), or erase the whole short end. Canopy overhang
          is separate from the 16px ground footprint.{" "}
          <Link to="/review/pattern%3Afenced-trees-v1-long">Review kit →</Link> ·{" "}
          <Link to="/tool/art?sheet=me-complete&rect=1568,0,208,96">
            Inspect caps and repeat art →
          </Link>{" "}
          · <a href="/tilefun/?editor=1">Try the game’s Patterns tab ↗</a>
        </p>
      ) : family === "rooms-v1" ? (
        <p>
          Draw a rectangle for walls and floor, then switch to Wall, Door or a room floor. Door
          edits use the existing reachability/topology checks.{" "}
          <Link to="/tool/indoor">Existing room documents and tile overrides →</Link>
        </p>
      ) : (
        <p>
          Uses the same terrain cells, adjacency solver and chunk renderer as the game. City
          pavement resolves its curb joins from its neighbors.
        </p>
      )}
      {roomDraftWarning(doc) ? (
        <p className="notice">
          Unfinished room draft: {roomDraftWarning(doc)} Add doors before using it as a playable
          prefab.
        </p>
      ) : null}
      <details>
        <summary>Semantic document / rule contract</summary>
        <p>
          {gridSize}px anchors · connections: {familyDefinition(family).connections.join(", ")} ·
          dirty halo: {familyDefinition(family).dirtyHalo}
        </p>
        <pre>{family === "rooms-v1" ? roomSketch(doc) : JSON.stringify(doc, null, 2)}</pre>
      </details>
    </section>
  );
}
