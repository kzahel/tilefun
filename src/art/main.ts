import "./art.css";
import {
  type ArtCatalog,
  type ArtRect,
  type ArtSheet,
  type ArtSlice,
  type ArtUsage,
  inflateSlices,
  intersects,
  required,
  snapRegion,
  validateRect,
} from "./ArtCatalog.js";
import { ArtNoteInbox } from "./ArtNoteInbox.js";
import type { ArtNote } from "./ArtNotes.js";
import { loadVerifiedArtImage } from "./ArtSource.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const catalog = await fetchJson<ArtCatalog>("data/art-catalog.json");
const canvas = $<HTMLCanvasElement>("atlas"),
  ctx = required(canvas.getContext("2d"));
const crop = $<HTMLCanvasElement>("crop"),
  cropCtx = required(crop.getContext("2d"));
const sheetSelect = $<HTMLSelectElement>("sheet"),
  search = $<HTMLInputElement>("search"),
  theme = $<HTMLSelectElement>("theme"),
  filter = $<HTMLSelectElement>("filter");
const noteInput = $<HTMLTextAreaElement>("note");
const STORAGE = "tilefun.art-workbench.v1";
let stored: {
  sheetId?: string;
  selection?: ArtRect;
  note?: string;
  outbox?: ArtNote[];
  records?: ArtNote[];
} = {};
try {
  stored = JSON.parse(localStorage.getItem(STORAGE) ?? "{}");
} catch {
  /* Corrupt local state must not block browsing. */
}
const inbox = new ArtNoteInbox(catalog, STORAGE);
const outbox = inbox.outbox;
let sheet: ArtSheet,
  image: HTMLImageElement | null = null,
  slices: ArtSlice[] = [],
  uses: ArtUsage[] = [];
let selection: ArtRect | null = null,
  zoom = 1,
  camera = { x: 0, y: 0 },
  loadToken = 0,
  resultLimit = 60,
  regionMode = false;
let saveProblem = "";
const sheetCache = new Map<string, ArtSlice[]>();
function text(tag: string, value: string, className?: string): HTMLElement {
  const el = document.createElement(tag);
  el.textContent = value;
  if (className) el.className = className;
  return el;
}
function button(label: string, click: () => void): HTMLButtonElement {
  const el = text("button", label) as HTMLButtonElement;
  el.type = "button";
  el.onclick = click;
  return el;
}
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Server returned ${response.status}`);
  return response.json() as Promise<T>;
}
function persist(): void {
  try {
    localStorage.setItem(
      STORAGE,
      JSON.stringify({
        sheetId: sheet?.id,
        selection,
        note: noteInput.value,
        outbox,
        records: inbox.records,
      }),
    );
    saveProblem = "";
  } catch {
    saveProblem = "Browser storage is full. Keep this page open or export notes.";
  }
}
function updateSync(message = ""): void {
  $("sync").textContent =
    saveProblem || inbox.storageProblem || (outbox.length ? inbox.status : message || inbox.status);
}
async function sync(): Promise<void> {
  await inbox.sync();
}
function currentNotes(): ArtNote[] {
  return inbox.notes;
}
function enqueue(row: ArtNote): void {
  inbox.enqueue(row);
  persist();
}
inbox.onchange = () => {
  renderNotes();
  updateSync();
};
function shareUrl(): string {
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("sheet", sheet.id);
  if (selection) url.searchParams.set("rect", selection.join(","));
  else url.searchParams.set("view", "sheet");
  if (search.value) url.searchParams.set("q", search.value);
  if (theme.value) url.searchParams.set("theme", theme.value);
  if (filter.value !== "all") url.searchParams.set("filter", filter.value);
  if ($<HTMLSelectElement>("note-filter").value !== "pending")
    url.searchParams.set("noteStatus", $<HTMLSelectElement>("note-filter").value);
  return url.href;
}
function setSelection(rect: ArtRect | null, focus = false): void {
  selection = rect;
  $("save-note").toggleAttribute("disabled", !rect || !image);
  if (rect && focus) {
    camera = { x: rect[0] + rect[2] / 2, y: rect[1] + rect[3] / 2 };
    zoom = Math.max(
      0.125,
      Math.min(
        6,
        (canvas.clientWidth - 60) / Math.max(rect[2], 160),
        (canvas.clientHeight - 60) / Math.max(rect[3], 160),
      ),
    );
  }
  renderSelection();
  draw();
  persist();
  if (sheet) history.replaceState(null, "", shareUrl());
}
function renderSelection(): void {
  const info = $("selection-info");
  info.replaceChildren();
  if (!selection || !image) {
    $("coordinates").textContent = "Tap a tile, select a region, or choose a slice.";
    crop.width = 1;
    crop.height = 1;
    return;
  }
  const [x, y, w, h] = selection;
  $("coordinates").textContent = `${sheet.id} · x ${x}, y ${y}, ${w}×${h} px`;
  const scale = Math.min(3, 640 / w, 640 / h);
  crop.width = Math.max(1, Math.round(w * scale));
  crop.height = Math.max(1, Math.round(h * scale));
  cropCtx.imageSmoothingEnabled = false;
  cropCtx.drawImage(image, x, y, w, h, 0, 0, crop.width, crop.height);
  const matching = slices.filter((s) => intersects(s.rect, required(selection)));
  const matchingUses = uses.filter((u) => intersects(u.rect, required(selection)));
  if (!matchingUses.length)
    info.append(
      text(
        "p",
        "No recorded use here. This may be unexplored art or a usage not yet tracked.",
        "no-use",
      ),
    );
  if (matchingUses.length) {
    const section = document.createElement("details");
    section.open = true;
    section.append(text("summary", `${matchingUses.length} recorded uses`));
    const list = document.createElement("ul");
    for (const use of matchingUses.slice(0, 40)) {
      const li = text("li", `${use.label} · ${use.kind}`);
      for (const consumer of use.consumers.slice(0, 12)) {
        li.append(text("div", consumer.system));
        li.append(text("code", consumer.source));
      }
      list.append(li);
    }
    section.append(list);
    info.append(section);
  }
  const section = document.createElement("details");
  section.open = matching.length <= 4;
  section.append(text("summary", `${matching.length} intersecting indexed slices`));
  const list = document.createElement("ul");
  for (const slice of matching.slice(0, 40)) {
    const li = text("li", slice.key);
    if (slice.source) li.append(text("code", slice.source));
    list.append(li);
  }
  section.append(list);
  info.append(section);
  info.append(
    text(
      "p",
      "Recorded uses come from source definitions and literal references. Indexed means sliced and available; it does not imply placement in a generated world.",
      "muted",
    ),
  );
}
function renderResults(): void {
  const query = search.value.toLowerCase().trim();
  const items = [
    ...slices.map((s) => ({ ...s, usage: false })),
    ...uses.map((u) => ({
      key: u.id,
      name: u.label,
      theme: `Recorded ${u.kind}`,
      rect: u.rect,
      usage: true,
    })),
  ];
  const visible = items.filter(
    (s) =>
      (!query || `${s.name} ${s.theme} ${s.key}`.toLowerCase().includes(query)) &&
      (!theme.value || s.theme === theme.value) &&
      (filter.value !== "uses" || s.usage) &&
      (filter.value !== "indexed" || !s.usage) &&
      (filter.value !== "unclaimed" || (!s.usage && !uses.some((u) => intersects(u.rect, s.rect)))),
  );
  $("counts").textContent =
    `${slices.length.toLocaleString()} indexed slices · ${uses.length} recorded uses · ${visible.length.toLocaleString()} results`;
  const results = $("results");
  results.replaceChildren();
  for (const item of visible.slice(0, resultLimit)) {
    const el = button(item.name, () => setSelection(item.rect, true));
    el.dataset.key = item.key;
    el.append(
      text(
        "small",
        `${item.usage ? "Recorded use" : "Indexed slice"} · ${item.theme} · ${item.rect[2]}×${item.rect[3]}`,
      ),
    );
    results.append(el);
  }
  $("more").hidden = visible.length <= resultLimit;
}
function fitSheet(): void {
  camera = { x: sheet.width / 2, y: sheet.height / 2 };
  zoom = Math.min(canvas.clientWidth / sheet.width, canvas.clientHeight / sheet.height) * 0.94;
  draw();
}
function draw(): void {
  const width = canvas.clientWidth,
    height = canvas.clientHeight,
    dpr = Math.min(devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (!sheet || !image) return;
  ctx.translate(width / 2 - camera.x * zoom, height / 2 - camera.y * zoom);
  ctx.scale(zoom, zoom);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0);
  const visible: ArtRect = [
    camera.x - width / 2 / zoom,
    camera.y - height / 2 / zoom,
    width / zoom,
    height / zoom,
  ];
  const outline = (rect: ArtRect, color: string, line: number) => {
    if (!intersects(rect, visible)) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = line / zoom;
    ctx.strokeRect(...rect);
  };
  if ($<HTMLInputElement>("overlays").checked) {
    // Showing 19k indexed boxes at whole-sheet scale obscures the art. Uses stay visible.
    if (zoom >= 0.6) for (const s of slices) outline(s.rect, "#80bfee66", 0.5);
    for (const u of uses) outline(u.rect, "#83d6a4aa", 1);
  }
  for (const n of currentNotes())
    if (
      !n.sceneAnnotation &&
      n.sheetId === sheet.id &&
      n.fingerprint === sheet.fingerprint &&
      n.status !== "resolved"
    )
      outline(n.rect, "#e49bc6", 2);
  if (selection) {
    ctx.fillStyle = "#e9c36c22";
    ctx.fillRect(...selection);
    outline(selection, "#ffe29a", 2);
  }
  $("zoom").textContent = `${Math.round(zoom * 100)}%`;
}
async function loadSheet(id: string, rect?: ArtRect): Promise<void> {
  const next = required(
    catalog.sheets.find((s) => s.id === id),
    "Unknown tileset",
  );
  const token = ++loadToken;
  $("app").dataset.ready = "false";
  sheet = next;
  sheetSelect.value = id;
  image = null;
  selection = null;
  slices = [];
  uses = catalog.usages.filter((u) => u.sheetId === id);
  $("save-note").setAttribute("disabled", "");
  $("canvas-message").textContent = "Loading source sheet…";
  draw();
  renderSelection();
  try {
    const [loadedImage, entries] = await Promise.all([
      loadVerifiedArtImage(next),
      next.index
        ? sheetCache.has(id)
          ? Promise.resolve(required(sheetCache.get(id)))
          : fetchJson<unknown>(next.index).then((index) => inflateSlices(next, index))
        : Promise.resolve([]),
    ]);
    if (token !== loadToken) return;
    image = loadedImage;
    slices = entries;
    sheetCache.set(id, entries);
    const names = [
      ...new Set([...slices.map((s) => s.theme), ...uses.map((u) => `Recorded ${u.kind}`)]),
    ].sort();
    theme.replaceChildren(new Option("All themes", ""), ...names.map((n) => new Option(n, n)));
    $("sheet-detail").textContent =
      `${next.width}×${next.height} native pixels · ${next.tileSize}px selection grid · ${next.source}`;
    $("canvas-message").textContent = "";
    renderResults();
    fitSheet();
    if (rect) setSelection(validateRect(rect, next), true);
    else setSelection(null);
    $("app").dataset.ready = "true";
  } catch (error) {
    if (token === loadToken)
      $("canvas-message").textContent =
        `Could not load sheet: ${error instanceof Error ? error.message : error}`;
  }
}
function renderNotes(): void {
  const container = $("notes");
  container.replaceChildren();
  const status = $<HTMLSelectElement>("note-filter").value;
  const notes = currentNotes()
    .filter((n) => status === "all" || n.status === status)
    .reverse();
  container.append(
    text(
      "p",
      `${notes.length} ${status === "all" ? "total" : status} notes across all sheets`,
      "note-count",
    ),
  );
  for (const row of notes) {
    const article = document.createElement("article");
    article.dataset.thread = row.threadId;
    const source = catalog.sheets.find((s) => s.id === row.sheetId);
    article.append(
      text("strong", `${row.intent} · ${row.status}`),
      text("p", row.note),
      text(
        "small",
        row.sceneAnnotation
          ? `World pixels · ${row.sceneAnnotation.rect.join(", ")}`
          : `${source?.name ?? row.sheetId} · ${row.rect.join(", ")}`,
      ),
    );
    if (row.buildingReview) {
      const link = document.createElement("a");
      link.href = row.buildingReview.url;
      link.textContent = `Review ${row.buildingReview.caseId ?? row.buildingReview.scene}: ${row.buildingReview.surfaceRecipe ?? row.buildingReview.prefabIds.join(", ")}`;
      article.append(link);
    }
    if (source?.fingerprint !== row.fingerprint)
      article.append(
        text(
          "p",
          "Source sheet changed since this note. Check the recorded revision before using these coordinates.",
          "stale",
        ),
      );
    if (outbox.some((r) => r.threadId === row.threadId))
      article.append(text("p", "Pending server save", "muted"));
    if (row.reply) article.append(text("p", `Reply: ${row.reply}`));
    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(
      button("View selection", () => {
        if (row.sceneAnnotation) {
          location.assign(
            `/tilefun/workshop.html#/scene/${encodeURIComponent(row.sceneAnnotation.candidateId.replace("district:", ""))}?note=${row.threadId}`,
          );
          return;
        }
        search.value = "";
        filter.value = "all";
        void loadSheet(row.sheetId, row.rect);
      }),
    );
    for (const [label, next] of [
      ["Start", "in-progress"],
      ["Resolve", "resolved"],
      ["Reopen", "pending"],
    ] as const)
      if (row.status !== next)
        actions.append(
          button(label, () =>
            enqueue({
              ...row,
              id: crypto.randomUUID(),
              status: next,
              createdAt: new Date().toISOString(),
            }),
          ),
        );
    article.append(actions);
    container.append(article);
  }
  draw();
}
sheetSelect.replaceChildren(...catalog.sheets.map((s) => new Option(s.name, s.id)));
sheetSelect.onchange = () => {
  filter.value = "all";
  search.value = "";
  resultLimit = 60;
  void loadSheet(sheetSelect.value);
};
for (const input of [search, theme, filter])
  input.addEventListener("input", () => {
    resultLimit = 60;
    renderResults();
    history.replaceState(null, "", shareUrl());
  });
$("more").onclick = () => {
  resultLimit += 60;
  renderResults();
};
$("fit").onclick = fitSheet;
$("overlays").onchange = draw;
function setMode(region: boolean): void {
  regionMode = region;
  $("pan").setAttribute("aria-pressed", String(!region));
  $("select-region").setAttribute("aria-pressed", String(region));
  canvas.style.cursor = region ? "crosshair" : "grab";
}
$("pan").onclick = () => setMode(false);
$("select-region").onclick = () => setMode(true);
function zoomAt(factor: number, x = canvas.clientWidth / 2, y = canvas.clientHeight / 2): void {
  const before = {
    x: camera.x + (x - canvas.clientWidth / 2) / zoom,
    y: camera.y + (y - canvas.clientHeight / 2) / zoom,
  };
  zoom = Math.max(0.03, Math.min(12, zoom * factor));
  camera = {
    x: before.x - (x - canvas.clientWidth / 2) / zoom,
    y: before.y - (y - canvas.clientHeight / 2) / zoom,
  };
  draw();
}
$("zoom-in").onclick = () => zoomAt(1.5);
$("zoom-out").onclick = () => zoomAt(1 / 1.5);
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    zoomAt(Math.exp(-e.deltaY * 0.002), e.offsetX, e.offsetY);
  },
  { passive: false },
);
const pointers = new Map<number, { x: number; y: number }>();
let drag: {
  origin: { x: number; y: number };
  start: { x: number; y: number };
  camera: { x: number; y: number };
  moved: boolean;
  multi: boolean;
} | null = null;
function local(e: PointerEvent) {
  const box = canvas.getBoundingClientRect();
  return { x: e.clientX - box.left, y: e.clientY - box.top };
}
function sourceAt(p: { x: number; y: number }) {
  return {
    x: Math.max(0, Math.min(sheet.width - 1, camera.x + (p.x - canvas.clientWidth / 2) / zoom)),
    y: Math.max(0, Math.min(sheet.height - 1, camera.y + (p.y - canvas.clientHeight / 2) / zoom)),
  };
}
canvas.addEventListener("pointerdown", (e) => {
  if (!image) return;
  canvas.setPointerCapture(e.pointerId);
  const p = local(e);
  pointers.set(e.pointerId, p);
  if (pointers.size === 1)
    drag = { origin: p, start: sourceAt(p), camera: { ...camera }, moved: false, multi: false };
  else if (drag) drag.multi = true;
});
canvas.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId) || !drag) return;
  const p = local(e);
  const old = [...pointers.values()];
  pointers.set(e.pointerId, p);
  if (pointers.size === 2) {
    const updated = [...pointers.values()];
    const a = required(old[0]),
      b = required(old[1]),
      c = required(updated[0]),
      d = required(updated[1]);
    const distance = Math.hypot(a.x - b.x, a.y - b.y),
      next = Math.hypot(c.x - d.x, c.y - d.y);
    if (distance > 0) zoomAt(next / distance, (c.x + d.x) / 2, (c.y + d.y) / 2);
    drag.multi = true;
    return;
  }
  if (drag.multi) return;
  if (Math.hypot(p.x - drag.origin.x, p.y - drag.origin.y) > 4) drag.moved = true;
  if (regionMode) {
    selection = snapRegion(drag.start, sourceAt(p), sheet);
    draw();
  } else {
    camera = {
      x: drag.camera.x - (p.x - drag.origin.x) / zoom,
      y: drag.camera.y - (p.y - drag.origin.y) / zoom,
    };
    draw();
  }
});
function endPointer(e: PointerEvent, cancel = false): void {
  if (!drag) return;
  const end = drag;
  pointers.delete(e.pointerId);
  if (!pointers.size) {
    drag = null;
    if (!cancel && !end.multi && (regionMode || !end.moved))
      setSelection(snapRegion(end.start, regionMode ? sourceAt(local(e)) : end.start, sheet));
  }
}
canvas.addEventListener("pointerup", (e) => endPointer(e));
canvas.addEventListener("pointercancel", (e) => endPointer(e, true));
canvas.addEventListener("keydown", (e) => {
  const delta: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const d = delta[e.key];
  if (d) {
    e.preventDefault();
    camera.x += (d[0] * 100) / zoom;
    camera.y += (d[1] * 100) / zoom;
    draw();
  } else if (e.key === "+" || e.key === "=") zoomAt(1.5);
  else if (e.key === "-") zoomAt(1 / 1.5);
});
new ResizeObserver(draw).observe($("viewport"));
$("apartments").onclick = async () => {
  search.value = "Condo";
  filter.value = "indexed";
  await loadSheet("me-complete");
  const candidate = slices.find((s) => s.key === "ME_Singles_Generic_Building_16x16_Condo_4_3");
  if (candidate) setSelection([candidate.rect[0] - 80, candidate.rect[1] - 80, 512, 448], true);
};
$("terraces").onclick = async () => {
  search.value = "terraced-house";
  filter.value = "uses";
  await loadSheet("me-complete");
  const candidate = uses.find((u) => u.id === "prop:prop-terraced-house-1");
  if (candidate) setSelection(candidate.rect, true);
};
$("facades").onclick = async () => {
  search.value = "prop-regional-apartment";
  filter.value = "uses";
  await loadSheet("me-complete");
  const candidate = uses.find((u) => u.id === "recipe:prop-regional-apartment-2:0");
  if (candidate) setSelection([candidate.rect[0] - 16, candidate.rect[1] - 176, 144, 224], true);
};
$("copy-link").onclick = () => {
  void navigator.clipboard.writeText(shareUrl()).then(
    () => updateSync("Selection link copied."),
    () => updateSync("Copy the selection URL from the address bar."),
  );
};
noteInput.value = stored.note ?? "";
noteInput.oninput = persist;
$("note-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!selection || !image || !noteInput.value.trim()) return;
  const id = crypto.randomUUID();
  const row: ArtNote = {
    id,
    threadId: id,
    sheetId: sheet.id,
    fingerprint: sheet.fingerprint,
    sheetSize: [sheet.width, sheet.height],
    rect: [...selection],
    sliceKeys: slices
      .filter((s) => intersects(s.rect, required(selection)))
      .slice(0, 40)
      .map((s) => s.key),
    intent: $<HTMLSelectElement>("intent").value as ArtNote["intent"],
    status: "pending",
    note: noteInput.value.trim(),
    reply: "",
    createdAt: new Date().toISOString(),
  };
  noteInput.value = "";
  enqueue(row);
});
$("refresh").onclick = () => void sync();
$("note-filter").onchange = () => {
  renderNotes();
  history.replaceState(null, "", shareUrl());
};
$("export").onclick = () => {
  const blob = new Blob([JSON.stringify({ version: 1, notes: currentNotes(), outbox }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tilefun-art-notes.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
window.addEventListener("online", () => void sync());
setInterval(() => {
  if (outbox.length) void sync();
}, 15000);
const params = new URLSearchParams(location.search);
search.value = params.get("q") ?? "";
if ([...filter.options].some((o) => o.value === params.get("filter")))
  filter.value = params.get("filter") ?? "all";
const noteFilter = $<HTMLSelectElement>("note-filter");
if ([...noteFilter.options].some((o) => o.value === params.get("noteStatus")))
  noteFilter.value = params.get("noteStatus") ?? "pending";
let initialRect: ArtRect | undefined;
try {
  const value = params.get("rect");
  if (value)
    initialRect = validateRect(
      value.split(",").map(Number),
      required(catalog.sheets.find((s) => s.id === params.get("sheet"))),
    );
  else if (
    params.get("view") !== "sheet" &&
    (!params.has("sheet") || params.get("sheet") === stored.sheetId) &&
    stored.selection
  )
    initialRect = stored.selection;
} catch {
  /* Invalid bookmarks open the full sheet. */
}
await loadSheet(
  catalog.sheets.some((s) => s.id === params.get("sheet"))
    ? required(params.get("sheet"))
    : stored.sheetId && catalog.sheets.some((s) => s.id === stored.sheetId)
      ? stored.sheetId
      : "me-complete",
  initialRect,
);
if ([...theme.options].some((o) => o.value === params.get("theme")))
  theme.value = params.get("theme") ?? "";
renderResults();
history.replaceState(null, "", shareUrl());
renderNotes();
void sync();
