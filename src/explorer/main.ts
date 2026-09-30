import {
  createDescriptor,
  descriptorChoice,
  descriptorFromMetadata,
  GENERATOR_CATALOG,
  type GeneratorChoice,
  REGIONAL_REVISIONS,
  resolveDescriptor,
} from "../generation/GenerationDescriptor.js";
import type { OverviewResult as RegionalResult } from "../generation/Overview.js";
import { QUERY_LIMITS } from "../generation/regional/RegionalPlanner.js";
import { regionalWorld, seedFromText } from "../generation/regional/WorldDescriptor.js";
import type { InspectionSnapshot } from "../persistence/WorldInspection.js";
import { featureAt, type MapFeature, MapRenderer, mapFeatures } from "./MapRenderer.js";
import { DEFAULT_PREVIEW, explorerUrl, parseExplorerLocation } from "./PreviewSettings.js";
import { QueryClient } from "./QueryClient.js";
import { type ReviewRecord, ReviewStore, reviewKey } from "./ReviewStore.js";
import { SavedWorldSource } from "./SavedWorldSource.js";
import { TilePreview } from "./TilePreview.js";
import {
  clampView,
  DEFAULT_OVERLAYS,
  DEFAULT_VIEW,
  type Overlays,
  screenToWorld,
  type ViewState,
  visibleBounds,
  zoomAt,
} from "./ViewState.js";
import "./explorer.css";

function element<T extends HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing explorer element: ${selector}`);
  return found;
}

const app = element("#app");
const canvas = element<HTMLCanvasElement>("#map");
const stage = element(".map-stage");
const loading = element("#loading");
const inspector = element("#inspection");
const seedInput = element<HTMLInputElement>("#seed");
const noteInput = element<HTMLInputElement>("#review-note");
const renderer = new MapRenderer();
const startedAt = performance.now();
let world = regionalWorld(2026);
let generation = createDescriptor("regional", 2026);
let preview = { ...DEFAULT_PREVIEW };
let view = { ...DEFAULT_VIEW };
let overlays = { ...DEFAULT_OVERLAYS };
let locationError: string | null = null;
try {
  ({ generation, view, overlays, preview } = parseExplorerLocation(location.href));
  world = regionalWorld(generation.type === "regional" ? generation.seed : 2026);
} catch (error) {
  locationError = error instanceof Error ? error.message : String(error);
}
let width = 1;
let height = 1;
let result: RegionalResult | null = null;
let selected: MapFeature | null = null;
let frame = 0;
let requestTimer = 0;
let noticeTimer = 0;
let disposed = false;
let drawMs = 0;
let maxDrawMs = 0;
let computeMs = 0;
let elapsedMs = 0;
let transferMs = 0;
let firstViewMs = 0;
let terrainMs = 0;
const tilePreview = new TilePreview(requestDraw);
let savedWorldId = new URL(location.href).searchParams.get("worldId");
const savedSource = new SavedWorldSource(location.href);
const serverAddress = savedSource.serverAddress;
let querySerial = 0;
async function snapshotFor(
  coordinates: { cx: number; cy: number }[],
  bounds: import("../generation/regional/RegionalPlanner.js").Bounds,
): Promise<InspectionSnapshot | undefined> {
  return savedWorldId
    ? savedSource.snapshot(savedWorldId, generation, coordinates, bounds)
    : undefined;
}
async function refreshSources(): Promise<void> {
  const worlds = await savedSource.listWorlds();
  const select = element<HTMLSelectElement>("#world-source");
  select.replaceChildren(new Option("Procedural world", ""));
  for (const meta of worlds) select.add(new Option(meta.name, meta.id));
  if (savedWorldId) {
    const meta = worlds.find((w) => w.id === savedWorldId);
    if (!meta) throw new Error("Saved world is unavailable from this authority.");
    generation = descriptorFromMetadata(meta);
    select.value = meta.id;
    syncSource();
    changedView(true);
  }
  select.onchange = () => {
    savedWorldId = select.value || null;
    if (savedWorldId) {
      const meta = worlds.find((w) => w.id === savedWorldId);
      if (meta) generation = descriptorFromMetadata(meta);
    }
    const url = new URL(location.href);
    if (savedWorldId) url.searchParams.set("worldId", savedWorldId);
    else url.searchParams.delete("worldId");
    history.replaceState(null, "", url);
    tilePreview.reset();
    syncSource();
    changedView(true);
  };
}
function syncSource(): void {
  element<HTMLSelectElement>("#generator").value = descriptorChoice(generation);
  seedInput.value = String(generation.seed);
  element<HTMLSelectElement>("#generator").disabled = !!savedWorldId;
  seedInput.disabled = !!savedWorldId;
  element<HTMLSelectElement>("#regional-revision").value = generation.version;
  element<HTMLSelectElement>("#regional-revision").disabled = !!savedWorldId;
  element("#world-version").textContent = `${generation.version} · ${generation.preset}`;
  element("#source-coverage").textContent = savedWorldId
    ? "Saved world · zoom into tiles to inspect edits"
    : "Procedural preview · no saved edits";
}

function notify(message: string): void {
  element("#notice").textContent = message;
  clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    element("#notice").textContent = "";
  }, 6000);
}

const worker = new Worker(new URL("./regional.worker.ts", import.meta.url), { type: "module" });
const client = new QueryClient(worker, (response) => {
  if (response.type === "error") {
    loading.hidden = false;
    loading.textContent = response.message;
    app.dataset.error = response.message;
    return;
  }
  if (response.type !== "result") return;
  result = response.result;
  terrainMs = response.terrainMs;
  tilePreview.accept(response.chunks, response.placements, response.actors);
  computeMs = response.computeMs;
  elapsedMs = response.elapsedMs;
  transferMs = Math.max(0, performance.timeOrigin + performance.now() - response.finishedAt);
  if (selected) selected = mapFeatures(result).find((f) => f.id === selected?.id) ?? null;
  loading.hidden = true;
  app.dataset.settled = "true";
  app.dataset.seed = String(result.world.seed);
  app.dataset.detail = result.detail;
  app.dataset.chunks = String(result.stats.detailedChunks);
  app.dataset.owners = String(result.stats.owners);
  app.dataset.features = String(result.stats.features);
  app.dataset.samples = String(result.stats.samples);
  updateInspection();
  updateHeading();
  requestDraw();
});
worker.onerror = () => {
  loading.hidden = false;
  loading.textContent = "The map worker stopped. Reload to try again.";
  app.dataset.error = "Worker failed";
  client.dispose();
};

function updateHeading(): void {
  const closest = result?.settlements
    .slice()
    .sort(
      (a, b) =>
        Math.hypot(a.center.x - view.x, a.center.y - view.y) -
        Math.hypot(b.center.x - view.x, b.center.y - view.y),
    )[0];
  element("#map-mode").textContent =
    result?.detail === "overview" ? "LANDSCAPE OVERVIEW" : "REGION";
  element("#map-title").textContent = closest
    ? `${closest.name} & the surrounding land`
    : "A landscape beyond the city";
  element("#map-subtitle").textContent =
    result?.detail === "overview"
      ? "Bounded landscape samples · zoom in for settlements"
      : "Settlement reservations · countryside · wild land";
}

function updateInspection(): void {
  inspector.replaceChildren();
  const eyebrow = document.createElement("span");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "FEATURE INSPECTOR";
  inspector.append(eyebrow);
  const title = document.createElement("h2");
  const description = document.createElement("p");
  if (!selected) {
    delete inspector.dataset.featureId;
    title.textContent = "Pick a place on the map";
    description.textContent =
      "Tap a settlement or a connection to inspect its identity and reservation.";
    inspector.append(title, description);
    return;
  }
  inspector.dataset.featureId = selected.id;
  title.textContent =
    selected.kind === "connection" ? "A connection between places" : selected.name;
  description.textContent =
    selected.kind === "connection"
      ? "A reserved orthogonal corridor. Unsupported water crossings are rejected."
      : selected.kind === "lot"
        ? `South-facing ${selected.buildingType} with a planned entrance at ${selected.entrance.x}, ${selected.entrance.y}.`
        : selected.kind === "farm"
          ? "An admitted dry field with a connected village lane, crops, and farm animals."
          : selected.kind === "woodland"
            ? "A dry woodland loop with trees, picnic space, and wildlife."
            : `${selected.kind === "city" ? "City" : "Village"} reservation with a dry buildable core. Blocks and entrances will refine this same place.`;
  inspector.append(title, description);
  const b = selected.bounds;
  const entries =
    selected.kind === "connection"
      ? [
          ["Corridor", `${selected.width} tiles wide`],
          ["Connects", selected.settlementIds.join(" ↔ ")],
        ]
      : [
          ["Center", `${selected.center.x}, ${selected.center.y}`],
          ["Reservation", `${b.maxX - b.minX} × ${b.maxY - b.minY} tiles`],
          [
            "Visible links",
            String(
              result?.connections.filter((c) => c.settlementIds.includes(selected?.id ?? ""))
                .length ?? 0,
            ),
          ],
        ];
  entries.push(["Owner cell", `${selected.owner.cx}, ${selected.owner.cy}`]);
  const dl = document.createElement("dl");
  for (const [label, value] of entries) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label ?? "";
    dd.textContent = value ?? "";
    dl.append(dt, dd);
  }
  const id = document.createElement("code");
  id.className = "feature-id";
  id.textContent = selected.id;
  inspector.append(dl, id);
}

function requestDraw(): void {
  if (frame || disposed) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const start = performance.now();
    renderer.draw(canvas, width, height, view, overlays, result, selected?.id ?? null);
    const pendingTiles = tilePreview.draw(canvas, width, height, view, preview.mode === "coverage");
    app.dataset.propIds = JSON.stringify(tilePreview.featureIds);
    app.dataset.actorIds = JSON.stringify(tilePreview.actorIds);
    app.dataset.tileReady = String(tilePreview.stats.ready);
    app.dataset.tileComplete = String(tilePreview.complete);
    app.dataset.tileResident = String(tilePreview.stats.resident);
    app.dataset.tileBytes = String(tilePreview.stats.bytes);
    app.dataset.generator = descriptorChoice(generation);
    if (pendingTiles) requestDraw();
    drawMs = performance.now() - start;
    maxDrawMs = Math.max(maxDrawMs, drawMs);
    if (result && !firstViewMs) {
      firstViewMs = performance.now() - startedAt;
      app.dataset.firstViewMs = firstViewMs.toFixed(2);
      app.dataset.ready = "true";
    }
    canvas.dataset.x = view.x.toFixed(3);
    canvas.dataset.y = view.y.toFixed(3);
    canvas.dataset.zoom = String(view.zoom);
    element("#coordinates").textContent =
      `X ${Math.round(view.x).toLocaleString()}  /  Y ${Math.round(view.y).toLocaleString()} tiles`;
    const desired = 100 / view.zoom;
    const magnitude = 10 ** Math.floor(Math.log10(desired));
    const length = (desired / magnitude >= 5 ? 5 : desired / magnitude >= 2 ? 2 : 1) * magnitude;
    element("#scale-label").textContent = `${length.toLocaleString()} tiles`;
    element("#scale-line").style.width = `${length * view.zoom}px`;
    updateDiagnostics();
  });
}

async function requestQuery(): Promise<void> {
  if (disposed || locationError) return;
  requestTimer = 0;
  const exact = tilePreview.prepare(generation, view, width, height, preview);
  const serial = ++querySerial;
  const footprint = tilePreview.footprint;
  let snapshot: InspectionSnapshot | undefined;
  try {
    if (footprint) snapshot = await snapshotFor(exact, footprint);
    if (serial !== querySerial || disposed) return;
    element("#source-coverage").textContent = snapshot
      ? `${snapshot.coverage} · ${snapshot.coverage === "saved snapshot" ? "live/unflushed changes unavailable" : "includes live edits"} · ${snapshot.capturedAt}`
      : savedWorldId
        ? "Map is procedural; saved edits appear in tiles"
        : "Procedural preview · no saved edits";
  } catch (error) {
    if (serial !== querySerial) return;
    element("#source-coverage").textContent = `Saved coverage unavailable: ${String(error)}`;
    app.dataset.error = String(error);
    return;
  }
  client.submit(
    generation,
    {
      bounds: visibleBounds(view, width, height),
      detail: "region",
      sampleStep: 6 / view.zoom,
      limits: { ...QUERY_LIMITS, maxSamples: preview.sampleBudget },
    },
    exact,
    footprint,
    snapshot,
  );
  updateDiagnostics();
}

function changedView(immediate = false): void {
  querySerial++;
  const gameUrl = new URL("./", location.href);
  if (serverAddress) gameUrl.searchParams.set("server", serverAddress);
  if (savedWorldId) gameUrl.searchParams.set("worldId", savedWorldId);
  gameUrl.searchParams.set("generation", JSON.stringify(generation));
  element<HTMLAnchorElement>("#create-world").href = gameUrl.href;
  gameUrl.searchParams.set("arrival", JSON.stringify({ x: view.x, y: view.y, generation }));
  element<HTMLAnchorElement>("#play-here").href = gameUrl.href;
  client.invalidate();
  app.dataset.settled = "false";
  requestDraw();
  clearTimeout(requestTimer);
  history.replaceState(null, "", explorerUrl(location.href, generation, view, overlays, preview));
  if (immediate) requestQuery();
  else requestTimer = window.setTimeout(requestQuery, 60);
}

function updateDiagnostics(): void {
  const queue = client.queued;
  app.dataset.queue = String(queue);
  app.dataset.drawMs = drawMs.toFixed(2);
  app.dataset.computeMs = computeMs.toFixed(2);
  app.dataset.firstViewMs = firstViewMs.toFixed(2);
  element("#queue-status").textContent = queue ? `${queue} queued / active` : "idle";
  const stats = result?.stats;
  const bytes = result
    ? result.elevation.byteLength + result.moisture.byteLength + result.cover.byteLength
    : 0;
  element("#diagnostics").innerText = [
    `Plan ${computeMs.toFixed(1)} ms CPU · ${elapsedMs.toFixed(1)} ms elapsed`,
    `Transfer ${transferMs.toFixed(1)} ms · draw ${drawMs.toFixed(1)} ms (max ${maxDrawMs.toFixed(1)})`,
    `Samples ${stats?.samples.toLocaleString() ?? "—"} · owners ${stats?.owners ?? "—"} · features ${stats?.features ?? "—"}`,
    `Actors ${tilePreview.actorIds.length} · static preview poses (game authority runs routes)`,
    `Detail ${tilePreview.stats.ready} ready / ${tilePreview.stats.resident} resident (cap 81) · buffers ${(bytes / 1024).toFixed(0)} KiB`,
    `Terrain ${terrainMs.toFixed(1)} ms · autotile ${tilePreview.stats.autotileMs.toFixed(1)} ms · detail memory ${(tilePreview.stats.bytes / 1024 / 1024).toFixed(1)} MiB`,
    `Terrain assets ${tilePreview.stats.assetsMs.toFixed(0)} ms${tilePreview.stats.error ? ` · ${tilePreview.stats.error}` : ""}`,
    `Jobs ${client.stats.submitted} · cancelled ${client.stats.cancelled} · stale ${client.stats.discarded}`,
    `First view ${firstViewMs ? `${firstViewMs.toFixed(0)} ms` : "pending"}`,
  ].join("\n");
}

const resize = new ResizeObserver(() => {
  width = Math.max(1, stage.clientWidth);
  height = Math.max(1, stage.clientHeight);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  changedView(true);
});
resize.observe(stage);

// Pointer capture keeps drags continuous outside the map and supports touch pinch.
const pointers = new Map<number, { x: number; y: number }>();
let gestureMoved = false;
let gestureStart = { x: 0, y: 0 };
function localPoint(event: PointerEvent | WheelEvent): { x: number; y: number } {
  const box = canvas.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}
canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  canvas.focus({ preventScroll: true });
  const point = localPoint(event);
  if (!pointers.size) {
    gestureStart = point;
    gestureMoved = false;
  } else gestureMoved = true;
  pointers.set(event.pointerId, point);
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  const previous = pointers.get(event.pointerId);
  if (!previous) return;
  const point = localPoint(event);
  const before = [...pointers.values()];
  pointers.set(event.pointerId, point);
  const after = [...pointers.values()];
  if (Math.hypot(point.x - gestureStart.x, point.y - gestureStart.y) > 5) gestureMoved = true;
  if (before.length >= 2) {
    const a = before[0];
    const b = before[1];
    const c = after[0];
    const d = after[1];
    if (!a || !b || !c || !d) return;
    const oldCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const newCenter = { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 };
    const oldDistance = Math.hypot(a.x - b.x, a.y - b.y);
    const newDistance = Math.hypot(c.x - d.x, c.y - d.y);
    view = zoomAt(view, width, height, oldCenter, oldDistance > 0 ? newDistance / oldDistance : 1);
    view = clampView({
      ...view,
      x: view.x - (newCenter.x - oldCenter.x) / view.zoom,
      y: view.y - (newCenter.y - oldCenter.y) / view.zoom,
    });
  } else {
    view = clampView({
      ...view,
      x: view.x - (point.x - previous.x) / view.zoom,
      y: view.y - (point.y - previous.y) / view.zoom,
    });
  }
  changedView();
});
function endPointer(event: PointerEvent): void {
  if (!pointers.has(event.pointerId)) return;
  pointers.delete(event.pointerId);
  if (event.type !== "pointercancel" && !pointers.size && !gestureMoved && result) {
    selected = featureAt(
      result,
      screenToWorld(view, width, height, localPoint(event)),
      view.zoom,
      overlays,
    );
    updateInspection();
    requestDraw();
  }
}
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("lostpointercapture", (event) => pointers.delete(event.pointerId));
canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
    view = zoomAt(
      view,
      width,
      height,
      localPoint(event),
      Math.exp(-Math.max(-200, Math.min(200, delta)) * 0.003),
    );
    changedView();
  },
  { passive: false },
);
canvas.addEventListener("keydown", (event) => {
  const movement: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const direction = movement[event.key];
  if (direction)
    view = clampView({
      ...view,
      x: view.x + (direction[0] * 100) / view.zoom,
      y: view.y + (direction[1] * 100) / view.zoom,
    });
  else if (event.key === "+" || event.key === "=" || event.key === "-")
    view = zoomAt(
      view,
      width,
      height,
      { x: width / 2, y: height / 2 },
      event.key === "-" ? 0.7 : 1.4,
    );
  else if (event.key === "Home") view = { ...DEFAULT_VIEW };
  else return;
  event.preventDefault();
  changedView();
});
element("#zoom-in").onclick = () => {
  view = zoomAt(view, width, height, { x: width / 2, y: height / 2 }, 1.6);
  changedView();
};
element("#zoom-out").onclick = () => {
  view = zoomAt(view, width, height, { x: width / 2, y: height / 2 }, 1 / 1.6);
  changedView();
};
element("#home").onclick = () => visitCase(0);

for (const checkbox of document.querySelectorAll<HTMLInputElement>("[data-layer]")) {
  const key = checkbox.dataset.layer as keyof Overlays;
  checkbox.checked = overlays[key];
  checkbox.onchange = () => {
    overlays[key] = checkbox.checked;
    history.replaceState(null, "", explorerUrl(location.href, generation, view, overlays, preview));
    requestDraw();
  };
}
const revisionSelect = element<HTMLSelectElement>("#regional-revision");
for (const revision of REGIONAL_REVISIONS)
  revisionSelect.add(new Option(revision.label, revision.version));
revisionSelect.value =
  generation.type === "regional" ? generation.version : createDescriptor("regional", 42).version;
const generatorSelect = element<HTMLSelectElement>("#generator");
const showRevision = () => {
  revisionSelect.parentElement?.toggleAttribute("hidden", generatorSelect.value !== "regional");
};
generatorSelect.addEventListener("change", showRevision);
for (const entry of GENERATOR_CATALOG) {
  const option = document.createElement("option");
  option.value = entry.choice;
  option.textContent = entry.label;
  generatorSelect.append(option);
}
generatorSelect.value = descriptorChoice(generation);
showRevision();
element("#world-version").textContent = `${generation.version} · ${generation.preset}`;
const modeSelect = element<HTMLSelectElement>("#display-mode");
modeSelect.value = preview.mode;
modeSelect.onchange = () => {
  preview.mode = modeSelect.value as typeof preview.mode;
  changedView(true);
};
for (const [id, key] of [
  ["detail-zoom", "detailZoom"],
  ["detail-radius", "radius"],
  ["sample-budget", "sampleBudget"],
] as const) {
  const input = element<HTMLInputElement>(`#${id}`);
  input.value = String(preview[key]);
  input.onchange = () => {
    if (!input.checkValidity()) {
      input.reportValidity();
      input.value = String(preview[key]);
      return;
    }
    preview[key] = Number(input.value);
    changedView(true);
  };
}
seedInput.value = String(generation.seed);
element<HTMLFormElement>("#seed-form").onsubmit = (event) => {
  event.preventDefault();
  if (savedWorldId) return;
  try {
    generation = createDescriptor(
      element<HTMLSelectElement>("#generator").value as GeneratorChoice,
      seedFromText(seedInput.value),
    );
    if (generation.type === "regional")
      generation = resolveDescriptor({
        ...generation,
        version: revisionSelect.value,
      } as typeof generation);
    world = regionalWorld(generation.type === "regional" ? generation.seed : 2026);
    element("#world-version").textContent = `${generation.version} · ${generation.preset}`;
    locationError = null;
    delete app.dataset.error;
    seedInput.value = String(generation.seed);
    result = null;
    selected = null;
    renderer.release();
    loading.hidden = false;
    loading.textContent = "Drawing this world…";
    updateInspection();
    if (generation.type === "classic" || generation.type === "flat") {
      view = { x: 0, y: 0, zoom: 4 };
      changedView(true);
      updateReview();
    } else visitCase(0);
  } catch (error) {
    notify(error instanceof Error ? error.message : String(error));
  }
};
element("#share").onclick = async () => {
  const url = explorerUrl(location.href, generation, view, overlays, preview);
  const field = element<HTMLInputElement>("#location-link");
  field.value = url;
  try {
    await navigator.clipboard.writeText(url);
    notify("Location copied. Seed, version, position, zoom, and layers are included.");
  } catch {
    field.hidden = false;
    field.select();
    notify("Copy the selected location link.");
  }
};

// Durable verdicts are user data; generated map results are never stored.
const cases: { id: string; title: string; view: ViewState }[] = [
  { id: "settlement-transition", title: "City / countryside", view: DEFAULT_VIEW },
  { id: "planning-boundary", title: "Across a cell boundary", view: { x: 0, y: 512, zoom: 0.65 } },
  { id: "broad-landscape", title: "The wider landscape", view: { x: 300, y: 519, zoom: 0.035 } },
  { id: "district-streets", title: "Blocks & entrances", view: { x: 300, y: 519, zoom: 3 } },
  { id: "district-art", title: "Apartments & park", view: { x: 275, y: 544, zoom: 16 } },
  { id: "farm-lane-v3", title: "Farm & village lane · v3", view: { x: 677, y: 1320, zoom: 16 } },
  { id: "woodland-loop-v3", title: "Woodland trail · v3", view: { x: -985, y: -985, zoom: 12 } },
];
const reviews = new ReviewStore(() => localStorage);
let currentCase = 0;
if (!reviews.load())
  notify("Review storage is unavailable. You can still export this session's notes.");
function currentReviewKey(caseId: string): string {
  return reviewKey(caseId, { generation, world, preview, view });
}
function updateReview(): void {
  const container = element("#review-cases");
  container.replaceChildren();
  let remaining = 0;
  cases.forEach((reviewCase, index) => {
    const record = reviews.get(currentReviewKey(reviewCase.id));
    if (!record) remaining++;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `case-button${index === currentCase ? " active" : ""}`;
    button.innerHTML = `<span class="case-number">0${index + 1}</span>${reviewCase.title}<span class="case-verdict">${record?.verdict === "approved" ? "✓" : record ? "!" : ""}</span>`;
    button.onclick = () => visitCase(index);
    container.append(button);
  });
  element("#remaining").textContent = remaining ? `${remaining} unchecked` : "Round complete";
}
function visitCase(index: number): void {
  const reviewCase = cases[index];
  if (!reviewCase) return;
  currentCase = index;
  view = { ...reviewCase.view };
  if (reviewCase.id === "planning-boundary") {
    overlays.boundaries = true;
    element<HTMLInputElement>('[data-layer="boundaries"]').checked = true;
  }
  selected = null;
  updateInspection();
  updateReview();
  changedView(true);
}
function recordReview(verdict: ReviewRecord["verdict"]): void {
  if (!result || app.dataset.settled !== "true") {
    notify("Wait for the current regional view to finish before reviewing it.");
    return;
  }
  const reviewCase = cases[currentCase];
  if (!reviewCase) return;
  const persisted = reviews.record(currentReviewKey(reviewCase.id), {
    caseId: reviewCase.id,
    world: { ...world },
    generation,
    preview: { ...preview },
    view: { ...view },
    bounds: visibleBounds(view, width, height),
    detail: result.detail,
    overlays: { ...overlays },
    featureId: selected?.id ?? null,
    verdict,
    note: noteInput.value.trim(),
    location: explorerUrl(location.href, generation, view, overlays, preview),
    createdAt: new Date().toISOString(),
  });
  if (persisted) {
    notify(
      verdict === "approved"
        ? "Approved. Moving to the next unchecked place."
        : "Report recorded. You can stop here and export your notes.",
    );
  } else {
    notify("Saved for this session only. Export your notes before leaving.");
  }
  noteInput.value = "";
  const next = cases.findIndex((c) => !reviews.get(currentReviewKey(c.id)));
  if (next >= 0) visitCase(next);
  else updateReview();
}
element("#approve").onclick = () => recordReview("approved");
element("#report").onclick = () => recordReview("reported");
element("#export-review").onclick = () => {
  const records = reviews.forWorld(generation, world);
  const url = URL.createObjectURL(
    new Blob([JSON.stringify({ formatVersion: 1, records }, null, 2)], {
      type: "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `tilefun-region-review-${world.seed}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
updateReview();
if (locationError) {
  loading.textContent = locationError;
  app.dataset.error = locationError;
}
const diagnosticsTimer = setInterval(updateDiagnostics, 250);

function dispose(): void {
  if (disposed) return;
  disposed = true;
  resize.disconnect();
  clearTimeout(requestTimer);
  clearTimeout(noticeTimer);
  clearInterval(diagnosticsTimer);
  cancelAnimationFrame(frame);
  client.dispose();
  renderer.release();
  tilePreview.dispose();
  result = null;
}
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) dispose();
  else {
    client.invalidate();
    clearTimeout(requestTimer);
  }
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) changedView(true);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    client.invalidate();
    clearTimeout(requestTimer);
  } else if (!disposed) changedView(true);
});

void refreshSources().catch((error) => {
  element("#source-coverage").textContent = String(error);
  if (savedWorldId) {
    locationError = String(error);
    client.invalidate();
    tilePreview.reset();
  }
});

element("#refresh-snapshot").onclick = () => {
  tilePreview.reset();
  changedView(true);
};
