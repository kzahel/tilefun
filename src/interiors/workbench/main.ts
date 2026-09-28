import {
  getModernInteriorsEntries,
  getModernInteriorsEntry,
  loadModernInteriorsAtlasIndex,
  type ModernInteriorsAtlasEntry,
} from "../../assets/ModernInteriorsAtlasIndex.js";
import type { PlanCell } from "../ApartmentFloorPlan.js";
import {
  drawLayeredInteriorMap,
  INTERIOR_DRAW_ORDER,
  type InteriorLayer,
  type LayeredInteriorMap,
} from "../LayeredInteriorMap.js";
import {
  builtInDocuments,
  compileWorkbenchDocument,
  eraseTileOverride,
  type InteriorIssue,
  issueSnapshot,
  PLAN_BRUSHES,
  paintPlanRectangle,
  parseWorkbenchDocument,
  setTileOverride,
  sketchRows,
  WORKBENCH_STORAGE_KEY,
  type WorkbenchDocument,
} from "./WorkbenchDocument.js";
import "./workbench.css";

type Tool = "pan" | "plan" | "tile" | "note" | "inspect";
type View = "split" | "plan" | "render";
type Selection = { x: number; y: number; width: number; height: number };
type Surface = "plan" | "render";
type Drag = {
  surface: Surface;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  scrollX: number;
  scrollY: number;
  clientX: number;
  clientY: number;
};

const app = document.getElementById("app");
if (!app) throw new Error("Indoor workbench root is missing");
app.innerHTML = `
  <header class="topbar">
    <h1>Indoor Workbench</h1>
    <select id="fixture-select" data-testid="fixture-select" aria-label="Fixture"></select>
    <input id="fixture-name" aria-label="Fixture name" placeholder="Fixture name" />
    <button id="create-fixture">New room</button>
    <button id="new-fixture">Duplicate</button>
    <button id="reset-fixture">Reset</button>
    <button id="delete-fixture">Delete</button>
    <button id="export-fixture" data-testid="export-fixture">Export</button>
    <button id="import-fixture">Import</button>
    <input id="import-file" type="file" accept="application/json,.json" hidden />
    <a href="./?panel=interiors">Atlas catalog ↗</a>
  </header>
  <div class="toolbar">
    <div class="toolgroup" id="tool-buttons"><span class="toolgroup-label">Tool</span>
      <button data-tool="pan">Pan</button><button data-tool="plan">Plan paint</button>
      <button data-tool="tile">Tile paint</button><button data-tool="note">Flag</button>
      <button data-tool="inspect">Inspect</button>
    </div>
    <div class="toolgroup" id="view-buttons"><span class="toolgroup-label">View</span>
      <button data-view-button="split">Split</button><button data-view-button="plan">Plan</button>
      <button data-view-button="render">Render</button>
    </div>
    <div class="toolgroup"><span class="toolgroup-label">Zoom</span>
      <button id="zoom-out" aria-label="Zoom out">−</button><span id="zoom-label">2×</span>
      <button id="zoom-in" aria-label="Zoom in">+</button><button id="center-view">Center</button>
    </div>
    <div class="toolgroup"><button id="undo">Undo</button><button id="redo">Redo</button></div>
  </div>
  <div id="status" data-testid="workbench-status">Loading atlas…</div>
  <div class="content">
    <div class="views" id="views" data-view="split">
      <section class="pane" id="plan-pane"><div class="pane-title">Floor plan <small>semantic cells</small></div>
        <div class="canvas-scroll" id="plan-scroll"><canvas id="plan-canvas" data-testid="plan-canvas"></canvas></div>
      </section>
      <section class="pane" id="render-pane"><div class="pane-title">Rendered zone <small>atlas tile layers</small></div>
        <div class="canvas-scroll" id="render-scroll"><canvas id="render-canvas" data-testid="render-canvas"></canvas></div>
      </section>
    </div>
    <aside class="inspector">
      <section id="plan-controls"><h2>Plan brush</h2><div id="plan-palette"></div>
        <label>Shape <select id="plan-shape"><option value="brush">Brush</option><option value="rectangle">Rectangle</option></select></label>
        <p>Paint room letters, walls, doors, or empty space. The render updates when the sketch is valid.</p>
      </section>
      <section id="tile-controls"><h2>Atlas tile brush</h2>
        <label>Layer <select id="tile-layer"><option value="floor">Floor</option><option value="wall" selected>Wall</option><option value="foreground">Foreground</option><option value="objects">Objects</option></select></label>
        <label>Category <select id="tile-category"></select></label>
        <label>Find tile <input id="tile-search" type="search" placeholder="e.g. c10-r03" /></label>
        <div class="row"><button id="erase-override">Erase selected override</button></div>
        <p id="palette-status"></p><div id="tile-palette" data-testid="tile-palette"></div>
      </section>
      <section><h2>Selected place</h2><div id="selection-details" data-testid="selection-details"><p>Tap either view to inspect a place.</p></div></section>
      <section id="note-controls"><h2>Flag a placement or zone</h2>
        <p>Choose Flag, then tap or drag a rectangle in either view. The note records the generated tile stack.</p>
        <label>Issue <select id="issue-category"><option value="wrong-tile">Wrong tile</option><option value="bad-join">Bad junction</option><option value="wrong-zone">Wrong zone</option><option value="other">Other</option></select></label>
        <label>What is wrong? <textarea id="issue-reason" rows="3" placeholder="Describe the intended wall, floor, or transition"></textarea></label>
        <button id="add-issue" data-testid="add-issue">Add flag</button>
      </section>
      <section><h2>Flags <span id="issue-count">0</span></h2><div id="issue-list" data-testid="issue-list"></div></section>
      <section><details><summary>Edit sketch text</summary><p class="hint">L living · B bedroom · K kitchen · T bath · H hall · # wall · + passage · space outside</p>
        <textarea id="sketch-text" spellcheck="false" wrap="off" data-testid="sketch-text"></textarea></details></section>
      <p class="hint">Saved in this browser. Export the JSON to share the fixture, tile overrides, and flags.</p>
    </aside>
  </div>`;

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing workbench element ${id}`);
  return found as T;
}

const fixtureSelect = element<HTMLSelectElement>("fixture-select");
const fixtureName = element<HTMLInputElement>("fixture-name");
const planCanvas = element<HTMLCanvasElement>("plan-canvas");
const renderCanvas = element<HTMLCanvasElement>("render-canvas");
const planScroll = element<HTMLDivElement>("plan-scroll");
const renderScroll = element<HTMLDivElement>("render-scroll");
const views = element<HTMLDivElement>("views");
const status = element<HTMLDivElement>("status");
const sketchText = element<HTMLTextAreaElement>("sketch-text");
const tileLayer = element<HTMLSelectElement>("tile-layer");
const tileCategory = element<HTMLSelectElement>("tile-category");
const tileSearch = element<HTMLInputElement>("tile-search");
const tilePalette = element<HTMLDivElement>("tile-palette");
const planPalette = element<HTMLDivElement>("plan-palette");
const issueList = element<HTMLDivElement>("issue-list");
const selectionDetails = element<HTMLDivElement>("selection-details");

function readDocuments(): Map<string, WorkbenchDocument> {
  const documents = new Map(builtInDocuments().map((item) => [item.id, item]));
  try {
    const stored = JSON.parse(localStorage.getItem(WORKBENCH_STORAGE_KEY) ?? "[]") as unknown;
    if (Array.isArray(stored)) {
      for (const item of stored) {
        const parsed = parseWorkbenchDocument(item);
        documents.set(parsed.id, parsed);
      }
    }
  } catch {
    // A corrupt local draft should not block the built-in fixtures.
  }
  return documents;
}

const documents = readDocuments();
const initialId = new URLSearchParams(location.search).get("fixture") ?? "small";
let current: WorkbenchDocument =
  documents.get(initialId) ??
  documents.get("small") ??
  (builtInDocuments()[0] as WorkbenchDocument);
let generated: LayeredInteriorMap | null = null;
let rendered: LayeredInteriorMap | null = null;
let atlasImage: HTMLImageElement | null = null;
let atlasEntries: ModernInteriorsAtlasEntry[] = [];
let tool: Tool = "inspect";
let view: View = matchMedia("(max-width: 900px)").matches ? "render" : "split";
let zoom = 2;
let planBrush: PlanCell = "#";
let tileBrush = "room-builder/3d-walls/c11-r02";
let selection: Selection | null = null;
let drag: Drag | null = null;
let undoStack: WorkbenchDocument[] = [];
let redoStack: WorkbenchDocument[] = [];
let sketchEditing = false;

function save(): void {
  documents.set(current.id, current);
  try {
    localStorage.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify([...documents.values()]));
  } catch {
    setStatus("Browser storage is full. Export this fixture to keep your edits.", true);
  }
}

function setStatus(message: string, error = false): void {
  status.textContent = message;
  status.classList.toggle("error", error);
}

function recordEdit(): void {
  undoStack.push(structuredClone(current));
  if (undoStack.length > 80) undoStack.shift();
  redoStack = [];
  updateUndoButtons();
}

function updateUndoButtons(): void {
  element<HTMLButtonElement>("undo").disabled = undoStack.length === 0;
  element<HTMLButtonElement>("redo").disabled = redoStack.length === 0;
}

function updateFixtureSelect(): void {
  fixtureSelect.replaceChildren();
  for (const item of documents.values()) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    fixtureSelect.appendChild(option);
  }
  fixtureSelect.value = current.id;
  fixtureName.value = current.name;
  const isBuiltIn = builtInDocuments().some((item) => item.id === current.id);
  element<HTMLButtonElement>("reset-fixture").disabled = !isBuiltIn;
  element<HTMLButtonElement>("delete-fixture").disabled = isBuiltIn;
}

function setTool(next: Tool): void {
  tool = next;
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-tool]")) {
    button.setAttribute("aria-pressed", String(button.dataset.tool === tool));
  }
  planCanvas.style.touchAction = tool === "pan" ? "auto" : "none";
  renderCanvas.style.touchAction = tool === "pan" ? "auto" : "none";
  element<HTMLDivElement>("plan-controls").style.display = tool === "plan" ? "block" : "none";
  element<HTMLDivElement>("tile-controls").style.display = tool === "tile" ? "block" : "none";
  element<HTMLDivElement>("note-controls").style.display = tool === "note" ? "block" : "none";
}

function setView(next: View): void {
  view = next;
  views.dataset.view = view;
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-view-button]")) {
    button.setAttribute("aria-pressed", String(button.dataset.viewButton === view));
  }
  focusSelection();
}

function planGeometry(): { rows: string[]; width: number; height: number } {
  const rows = sketchRows(current.sketch);
  return { rows, width: Math.max(0, ...rows.map((row) => row.length)), height: rows.length };
}

function drawPlan(): void {
  const { rows, width, height } = planGeometry();
  const size = 16 * zoom;
  const pad = 32;
  planCanvas.width = Math.max(64, width * size + 2 * pad);
  planCanvas.height = Math.max(64, height * size + 2 * pad);
  planCanvas.style.width = `${planCanvas.width}px`;
  planCanvas.style.height = `${planCanvas.height}px`;
  const ctx = planCanvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#131b27";
  ctx.fillRect(0, 0, planCanvas.width, planCanvas.height);
  const colors: Record<string, string> = {
    L: "#8b6853",
    B: "#916b64",
    K: "#8895a0",
    T: "#72869b",
    H: "#9a8265",
    "#": "#394b61",
    "+": "#188b7e",
    " ": "#182331",
  };
  ctx.font = `bold ${Math.max(12, size * 0.48)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const char = rows[y]?.[x] ?? " ";
      ctx.fillStyle = colors[char] ?? "#a13950";
      ctx.fillRect(pad + x * size, pad + y * size, size, size);
      ctx.strokeStyle = "#202b39";
      ctx.strokeRect(pad + x * size + 0.5, pad + y * size + 0.5, size, size);
      if (char !== " ") {
        ctx.fillStyle = "#f7f7f8";
        ctx.fillText(char, pad + x * size + size / 2, pad + y * size + size / 2);
      }
    }
  }
  for (const [index, issue] of current.issues.entries()) {
    const x = Math.floor(issue.x / 2);
    const y = Math.floor(issue.y / 2);
    const w = Math.ceil((issue.x + issue.width) / 2) - x;
    const h = Math.ceil((issue.y + issue.height) / 2) - y;
    ctx.strokeStyle = "#ff6779";
    ctx.lineWidth = 2;
    ctx.strokeRect(pad + x * size + 2, pad + y * size + 2, w * size - 4, h * size - 4);
    ctx.fillStyle = "#ff6779";
    ctx.fillText(String(index + 1), pad + x * size + size / 2, pad + y * size + size / 2);
  }
  if (selection) {
    const x = Math.floor(selection.x / 2);
    const y = Math.floor(selection.y / 2);
    const w = Math.ceil((selection.x + selection.width) / 2) - x;
    const h = Math.ceil((selection.y + selection.height) / 2) - y;
    ctx.strokeStyle = "#ffe15c";
    ctx.lineWidth = 3;
    ctx.strokeRect(pad + x * size + 2, pad + y * size + 2, w * size - 4, h * size - 4);
  }
}

function drawRender(): void {
  const map = rendered;
  if (!map || !atlasImage) {
    renderCanvas.width = 1;
    renderCanvas.height = 1;
    renderCanvas.style.width = "1px";
    renderCanvas.style.height = "1px";
    return;
  }
  const pad = 32;
  const size = 16 * zoom;
  renderCanvas.width = map.width * size + 2 * pad;
  renderCanvas.height = map.pixelHeight * zoom + 2 * pad;
  renderCanvas.style.width = `${renderCanvas.width}px`;
  renderCanvas.style.height = `${renderCanvas.height}px`;
  const ctx = renderCanvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#171e2a";
  ctx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);
  ctx.save();
  ctx.translate(pad, pad);
  ctx.scale(zoom, zoom);
  drawLayeredInteriorMap(ctx, atlasImage, map);
  ctx.restore();
  for (const [index, issue] of current.issues.entries()) {
    ctx.strokeStyle = "#ff6779";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      pad + issue.x * size + 2,
      pad + issue.y * size + 2,
      issue.width * size - 4,
      issue.height * size - 4,
    );
    ctx.fillStyle = "#ff6779";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(String(index + 1), pad + issue.x * size + 5, pad + issue.y * size + 17);
  }
  if (selection) {
    ctx.strokeStyle = "#ffe15c";
    ctx.lineWidth = 3;
    ctx.strokeRect(
      pad + selection.x * size + 2,
      pad + selection.y * size + 2,
      selection.width * size - 4,
      selection.height * size - 4,
    );
  }
}

function renderSelectionDetails(): void {
  selectionDetails.replaceChildren();
  if (!selection || !generated || !rendered) {
    const p = document.createElement("p");
    p.textContent = "Tap either view to inspect a place.";
    selectionDetails.appendChild(p);
    return;
  }
  const cell = generated.cells[selection.y]?.[selection.x];
  const shown = rendered.cells[selection.y]?.[selection.x];
  if (!cell || !shown) return;
  const summary = document.createElement("p");
  summary.textContent = `Tile ${selection.x},${selection.y} · plan ${Math.floor(selection.x / 2)},${Math.floor(selection.y / 2)} · ${cell.semantic}${selection.width > 1 || selection.height > 1 ? ` · ${selection.width}×${selection.height} area` : ""}`;
  selectionDetails.appendChild(summary);
  for (const layer of INTERIOR_DRAW_ORDER) {
    const layerTitle = document.createElement("p");
    layerTitle.textContent = `${layer}:`;
    selectionDetails.appendChild(layerTitle);
    for (const tile of cell[layer]) {
      const button = document.createElement("button");
      button.textContent = `Generated · ${tile.key}`;
      button.title = "Use this atlas tile as the brush";
      button.addEventListener("click", () => {
        tileBrush = tile.key;
        tileLayer.value = layer;
        tileCategory.value = getModernInteriorsEntry(tile.key)?.category ?? tileCategory.value;
        tileSearch.value = "";
        setTool("tile");
        renderPalette();
      });
      selectionDetails.appendChild(button);
    }
    const override = current.overrides.find(
      (item) => item.x === selection?.x && item.y === selection?.y && item.layer === layer,
    );
    if (override) {
      const p = document.createElement("p");
      p.textContent = `Override · ${override.key}`;
      selectionDetails.appendChild(p);
    }
  }
}

function renderIssues(): void {
  issueList.replaceChildren();
  element<HTMLSpanElement>("issue-count").textContent = String(current.issues.length);
  for (const [index, issue] of current.issues.entries()) {
    const row = document.createElement("div");
    row.className = "issue";
    const go = document.createElement("button");
    go.textContent = `${index + 1}. ${issue.category} @ ${issue.x},${issue.y}: ${issue.reason}`;
    go.addEventListener("click", () => {
      selection = { x: issue.x, y: issue.y, width: issue.width, height: issue.height };
      drawPlan();
      drawRender();
      renderSelectionDetails();
      focusSelection();
    });
    const remove = document.createElement("button");
    remove.textContent = "×";
    remove.title = "Remove flag";
    remove.addEventListener("click", () => {
      recordEdit();
      current.issues.splice(index, 1);
      save();
      renderAll();
    });
    row.append(go, remove);
    issueList.appendChild(row);
  }
}

function renderAll(): void {
  try {
    if (!atlasImage) return;
    const compiled = compileWorkbenchDocument(current);
    generated = compiled.generated;
    rendered = compiled.rendered;
    if (selection && (selection.x >= rendered.width || selection.y >= rendered.height))
      selection = null;
    setStatus(
      `${current.name} · ${generated.width}×${generated.height} atlas cells · ${current.overrides.length} tile overrides · ${current.issues.length} flags`,
    );
  } catch (error) {
    generated = null;
    rendered = null;
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
  if (!sketchEditing) sketchText.value = current.sketch;
  drawPlan();
  drawRender();
  renderSelectionDetails();
  renderIssues();
  updateUndoButtons();
}

function focusSelection(): void {
  if (!selection) return;
  const size = 16 * zoom;
  const planX = Math.floor(selection.x / 2) * size + 32;
  const planY = Math.floor(selection.y / 2) * size + 32;
  const renderX = selection.x * size + 32;
  const renderY = selection.y * size + 32;
  planScroll.scrollLeft = Math.max(0, planX - planScroll.clientWidth / 2);
  planScroll.scrollTop = Math.max(0, planY - planScroll.clientHeight / 2);
  renderScroll.scrollLeft = Math.max(0, renderX - renderScroll.clientWidth / 2);
  renderScroll.scrollTop = Math.max(0, renderY - renderScroll.clientHeight / 2);
}

function focusFirstOccupied(): void {
  if (!rendered) return;
  for (let y = 0; y < rendered.height; y++) {
    for (let x = 0; x < rendered.width; x++) {
      const cell = rendered.cells[y]?.[x];
      if (!cell || INTERIOR_DRAW_ORDER.every((layer) => cell[layer].length === 0)) continue;
      const size = 16 * zoom;
      planScroll.scrollLeft = Math.max(0, Math.floor(x / 2) * size - planScroll.clientWidth / 4);
      planScroll.scrollTop = Math.max(0, Math.floor(y / 2) * size - 64);
      renderScroll.scrollLeft = Math.max(0, x * size - renderScroll.clientWidth / 4);
      renderScroll.scrollTop = Math.max(0, y * size - 64);
      return;
    }
  }
}

function setSelection(next: Selection): void {
  selection = next;
  drawPlan();
  drawRender();
  renderSelectionDetails();
}

function pointOnCanvas(event: PointerEvent, surface: Surface): { x: number; y: number } | null {
  const canvas = surface === "plan" ? planCanvas : renderCanvas;
  const rect = canvas.getBoundingClientRect();
  const factorX = canvas.width / rect.width;
  const factorY = canvas.height / rect.height;
  const size = 16 * zoom;
  const x = Math.floor(((event.clientX - rect.left) * factorX - 32) / size);
  const y = Math.floor(((event.clientY - rect.top) * factorY - 32) / size);
  const boundX = surface === "plan" ? planGeometry().width : (rendered?.width ?? 0);
  const boundY = surface === "plan" ? planGeometry().height : (rendered?.height ?? 0);
  return x >= 0 && y >= 0 && x < boundX && y < boundY ? { x, y } : null;
}

function renderedSelection(
  surface: Surface,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Selection {
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const width = Math.abs(x2 - x1) + 1;
  const height = Math.abs(y2 - y1) + 1;
  return surface === "plan"
    ? { x: left * 2, y: top * 2, width: width * 2, height: height * 2 }
    : { x: left, y: top, width, height };
}

function applyPlanPaint(x1: number, y1: number, x2: number, y2: number): void {
  const next = paintPlanRectangle(current.sketch, x1, y1, x2, y2, planBrush);
  if (next === current.sketch) return;
  current = { ...current, sketch: next };
  save();
  renderAll();
}

function applyTilePaint(x: number, y: number): void {
  if (!rendered) return;
  const layer = tileLayer.value as InteriorLayer;
  const next = setTileOverride(current, { x, y, layer, key: tileBrush });
  if (
    next.overrides.length === current.overrides.length &&
    current.overrides.some(
      (item) => item.x === x && item.y === y && item.layer === layer && item.key === tileBrush,
    )
  )
    return;
  current = next;
  save();
  renderAll();
}

function bindCanvas(canvas: HTMLCanvasElement, surface: Surface): void {
  const scroller = surface === "plan" ? planScroll : renderScroll;
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const point = pointOnCanvas(event, surface);
    if (!point && tool !== "pan") return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    drag = {
      surface,
      startX: point?.x ?? 0,
      startY: point?.y ?? 0,
      lastX: point?.x ?? 0,
      lastY: point?.y ?? 0,
      scrollX: scroller.scrollLeft,
      scrollY: scroller.scrollTop,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    if (tool === "pan") return;
    if (!point) return;
    setSelection(renderedSelection(surface, point.x, point.y, point.x, point.y));
    if (tool === "plan" && surface === "plan") {
      recordEdit();
      if (element<HTMLSelectElement>("plan-shape").value === "brush")
        applyPlanPaint(point.x, point.y, point.x, point.y);
    } else if (tool === "tile" && surface === "render") {
      recordEdit();
      applyTilePaint(point.x, point.y);
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!drag || drag.surface !== surface) return;
    if (tool === "pan") {
      scroller.scrollLeft = drag.scrollX - (event.clientX - drag.clientX);
      scroller.scrollTop = drag.scrollY - (event.clientY - drag.clientY);
      return;
    }
    const point = pointOnCanvas(event, surface);
    if (!point || (point.x === drag.lastX && point.y === drag.lastY)) return;
    drag.lastX = point.x;
    drag.lastY = point.y;
    if (
      tool === "note" ||
      (tool === "plan" && element<HTMLSelectElement>("plan-shape").value === "rectangle")
    ) {
      setSelection(renderedSelection(surface, drag.startX, drag.startY, point.x, point.y));
    } else if (tool === "plan" && surface === "plan") {
      applyPlanPaint(point.x, point.y, point.x, point.y);
      setSelection(renderedSelection(surface, point.x, point.y, point.x, point.y));
    } else if (tool === "tile" && surface === "render") {
      applyTilePaint(point.x, point.y);
      setSelection(renderedSelection(surface, point.x, point.y, point.x, point.y));
    }
  });
  const finish = () => {
    if (!drag || drag.surface !== surface) return;
    if (
      tool === "plan" &&
      surface === "plan" &&
      element<HTMLSelectElement>("plan-shape").value === "rectangle"
    ) {
      applyPlanPaint(drag.startX, drag.startY, drag.lastX, drag.lastY);
    }
    drag = null;
  };
  canvas.addEventListener("pointerup", finish);
  canvas.addEventListener("pointercancel", finish);
}

function renderPalette(): void {
  if (!atlasImage) return;
  const query = tileSearch.value.trim().toLowerCase();
  const category = tileCategory.value;
  const matches = atlasEntries.filter(
    (entry) => entry.category === category && (!query || entry.key.toLowerCase().includes(query)),
  );
  element<HTMLParagraphElement>("palette-status").textContent =
    `${matches.length} tiles · showing first 80`;
  tilePalette.replaceChildren();
  for (const entry of matches.slice(0, 80)) {
    const button = document.createElement("button");
    button.className = `brush${entry.key === tileBrush ? " selected" : ""}`;
    button.title = entry.key;
    button.setAttribute("data-tile-key", entry.key);
    const thumb = document.createElement("canvas");
    thumb.width = 16;
    thumb.height = 16;
    const ctx = thumb.getContext("2d");
    if (ctx) {
      const [sx, sy, sw, sh] = entry.rect;
      ctx.drawImage(atlasImage, sx, sy, sw, sh, 0, 0, 16, 16);
    }
    const label = document.createElement("span");
    label.textContent = entry.key.split("/").at(-1) ?? entry.key;
    button.append(thumb, label);
    button.addEventListener("click", () => {
      tileBrush = entry.key;
      setTool("tile");
      renderPalette();
    });
    tilePalette.appendChild(button);
  }
}

function renderPlanPalette(): void {
  planPalette.replaceChildren();
  const names: Record<string, string> = {
    L: "Living",
    B: "Bedroom",
    K: "Kitchen",
    T: "Bath",
    H: "Hall",
    "#": "Wall",
    "+": "Door",
    " ": "Void",
  };
  for (const brush of PLAN_BRUSHES) {
    const button = document.createElement("button");
    button.textContent = brush === " " ? "∅" : brush;
    button.title = names[brush] ?? brush;
    button.className = brush === planBrush ? "selected" : "";
    button.setAttribute("data-plan-brush", brush);
    button.addEventListener("click", () => {
      planBrush = brush;
      renderPlanPalette();
    });
    planPalette.appendChild(button);
  }
}

function activateFixture(id: string): void {
  const next = documents.get(id);
  if (!next) return;
  current = next;
  selection = null;
  undoStack = [];
  redoStack = [];
  updateFixtureSelect();
  renderAll();
  focusFirstOccupied();
  history.replaceState(null, "", `${location.pathname}?fixture=${encodeURIComponent(id)}`);
}

fixtureSelect.addEventListener("change", () => activateFixture(fixtureSelect.value));
fixtureName.addEventListener("change", () => {
  const name = fixtureName.value.trim();
  if (!name || name === current.name) return;
  recordEdit();
  current = { ...current, name };
  save();
  updateFixtureSelect();
  renderAll();
});
element<HTMLButtonElement>("new-fixture").addEventListener("click", () => {
  const id = `custom-${crypto.randomUUID()}`;
  const copy: WorkbenchDocument = {
    ...structuredClone(current),
    id,
    name: `${current.name} copy`,
  };
  documents.set(id, copy);
  save();
  activateFixture(id);
  fixtureName.focus();
  fixtureName.select();
});
element<HTMLButtonElement>("create-fixture").addEventListener("click", () => {
  const id = `custom-${crypto.randomUUID()}`;
  const room: WorkbenchDocument = {
    version: 1,
    id,
    name: "Untitled room",
    sketch: ["########", ...Array(6).fill("#LLLLLL#"), "########"].join("\n"),
    overrides: [],
    issues: [],
  };
  documents.set(id, room);
  activateFixture(id);
  save();
  fixtureName.focus();
  fixtureName.select();
});
element<HTMLButtonElement>("reset-fixture").addEventListener("click", () => {
  const original = builtInDocuments().find((item) => item.id === current.id);
  if (!original) {
    setStatus("Duplicate a built-in fixture to create a fresh custom copy.", true);
    return;
  }
  recordEdit();
  current = original;
  save();
  updateFixtureSelect();
  renderAll();
});
element<HTMLButtonElement>("delete-fixture").addEventListener("click", () => {
  if (builtInDocuments().some((item) => item.id === current.id)) return;
  if (!window.confirm(`Delete "${current.name}" from this browser?`)) return;
  documents.delete(current.id);
  activateFixture("small");
  save();
});
element<HTMLButtonElement>("export-fixture").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(current, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${current.id.replace(/[^a-z0-9-]/gi, "-")}.indoor.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
element<HTMLButtonElement>("import-fixture").addEventListener("click", () =>
  element<HTMLInputElement>("import-file").click(),
);
element<HTMLInputElement>("import-file").addEventListener("change", async (event) => {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const loaded = parseWorkbenchDocument(JSON.parse(await file.text()));
    documents.set(loaded.id, loaded);
    activateFixture(loaded.id);
    save();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
  input.value = "";
});
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-tool]")) {
  button.addEventListener("click", () => setTool(button.dataset.tool as Tool));
}
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-view-button]")) {
  button.addEventListener("click", () => setView(button.dataset.viewButton as View));
}
element<HTMLButtonElement>("zoom-out").addEventListener("click", () => {
  zoom = Math.max(1, zoom - 1);
  element<HTMLSpanElement>("zoom-label").textContent = `${zoom}×`;
  renderAll();
  focusSelection();
});
element<HTMLButtonElement>("zoom-in").addEventListener("click", () => {
  zoom = Math.min(4, zoom + 1);
  element<HTMLSpanElement>("zoom-label").textContent = `${zoom}×`;
  renderAll();
  focusSelection();
});
element<HTMLButtonElement>("center-view").addEventListener("click", () => {
  if (selection) focusSelection();
  else focusFirstOccupied();
});
element<HTMLButtonElement>("undo").addEventListener("click", () => {
  const previous = undoStack.pop();
  if (!previous) return;
  redoStack.push(structuredClone(current));
  current = previous;
  save();
  updateFixtureSelect();
  renderAll();
});
element<HTMLButtonElement>("redo").addEventListener("click", () => {
  const next = redoStack.pop();
  if (!next) return;
  undoStack.push(structuredClone(current));
  current = next;
  save();
  updateFixtureSelect();
  renderAll();
});
element<HTMLButtonElement>("erase-override").addEventListener("click", () => {
  if (!selection) return;
  recordEdit();
  current = eraseTileOverride(current, selection.x, selection.y, tileLayer.value as InteriorLayer);
  save();
  renderAll();
});
element<HTMLButtonElement>("add-issue").addEventListener("click", () => {
  const reasonInput = element<HTMLTextAreaElement>("issue-reason");
  const reason = reasonInput.value.trim();
  if (!selection || !generated || !reason) {
    setStatus("Select a valid tile or area and write a reason before adding a flag.", true);
    return;
  }
  recordEdit();
  const issue: InteriorIssue = {
    id: crypto.randomUUID(),
    ...selection,
    category: element<HTMLSelectElement>("issue-category").value as InteriorIssue["category"],
    reason,
    snapshot: issueSnapshot(current.sketch, generated, selection.x, selection.y),
  };
  current.issues.push(issue);
  reasonInput.value = "";
  save();
  renderAll();
});
sketchText.addEventListener("focus", () => {
  sketchEditing = true;
  recordEdit();
});
sketchText.addEventListener("input", () => {
  current = { ...current, sketch: sketchText.value };
  save();
  renderAll();
});
sketchText.addEventListener("blur", () => {
  sketchEditing = false;
});
tileCategory.addEventListener("change", renderPalette);
tileSearch.addEventListener("input", renderPalette);
tileLayer.addEventListener("change", () => {
  const categories: Partial<Record<InteriorLayer, string>> = {
    floor: "floors",
    wall: "3d-walls",
    foreground: "3d-walls",
    objects: "object",
  };
  tileCategory.value = categories[tileLayer.value as InteriorLayer] ?? "3d-walls";
  const first = atlasEntries.find((entry) => entry.category === tileCategory.value);
  if (first) tileBrush = first.key;
  tileSearch.value = "";
  renderPalette();
  renderSelectionDetails();
});
bindCanvas(planCanvas, "plan");
bindCanvas(renderCanvas, "render");

async function loadAtlas(): Promise<HTMLImageElement> {
  await loadModernInteriorsAtlasIndex();
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the Modern Interiors atlas image"));
    image.src = "assets/tilesets/modern-interiors-atlas.png";
  });
}

async function start(): Promise<void> {
  try {
    atlasImage = await loadAtlas();
    atlasEntries = getModernInteriorsEntries().filter(
      (entry) => entry.sourceKind === "room_builder_tile" || entry.sourceKind === "single",
    );
    const categories = [...new Set(atlasEntries.map((entry) => entry.category))].sort();
    for (const category of categories) {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      tileCategory.appendChild(option);
    }
    tileCategory.value = "3d-walls";
    if (!getModernInteriorsEntry(tileBrush))
      throw new Error("Default wall tile is missing from the atlas");
    updateFixtureSelect();
    renderPlanPalette();
    renderPalette();
    setTool(tool);
    setView(view);
    renderAll();
    focusFirstOccupied();
    element<HTMLDivElement>("app").dataset.ready = "true";
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
}

void start();
