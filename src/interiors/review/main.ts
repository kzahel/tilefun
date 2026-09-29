import { loadModernInteriorsAtlasIndex } from "../../assets/ModernInteriorsAtlasIndex.js";
import { buildLayeredApartmentPlan } from "../ApartmentArchitecture.js";
import { parseFloorPlan } from "../ApartmentFloorPlan.js";
import { buildProfileApartmentPlan } from "../ApartmentWallProfiles.js";
import { drawLayeredInteriorMap } from "../LayeredInteriorMap.js";
import { REVIEW_STAGES, type ReviewCase, reviewCases } from "./ReviewCases.js";
import {
  currentVerdict,
  parseReviewFeedback,
  parseReviewPins,
  type ReviewFeedback,
  type ReviewPin,
} from "./ReviewFeedback.js";
import "./review.css";
import spriteIndexUrl from "./assets/review-sprites.json?url";
import spriteUrl from "./assets/review-sprites.png?url";

const STORAGE = "tilefun.indoor-review.v1";
const API = "/tilefun/api/interior-review";
interface ReadyCase extends ReviewCase {
  fingerprint: string;
}
interface State {
  current: string;
  stage: string;
  uncheckedOnly: boolean;
  records: ReviewFeedback[];
  outbox: ReviewFeedback[];
  batch: { id: string; fingerprint: string }[];
  paused: boolean;
  draft: string;
  annotation: { caseId: string; fingerprint: string; pins: ReviewPin[] } | null;
}
const initial: State = {
  current: "",
  stage: "all",
  uncheckedOnly: true,
  records: [],
  outbox: [],
  batch: [],
  paused: false,
  draft: "",
  annotation: null,
};
let state = initial;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE) ?? "null");
  if (
    saved &&
    typeof saved.current === "string" &&
    typeof saved.stage === "string" &&
    typeof saved.draft === "string" &&
    Array.isArray(saved.batch)
  ) {
    state = {
      ...initial,
      ...saved,
      uncheckedOnly: saved.uncheckedOnly !== false,
      records: saved.records.map(parseReviewFeedback),
      outbox: saved.outbox.map(parseReviewFeedback),
    };
    if (state.annotation) {
      const recordSketch =
        reviewCases().find((c) => c.id === state.annotation?.caseId)?.sketch ?? "";
      state.annotation.pins = parseReviewPins(state.annotation.pins, recordSketch);
    }
  }
} catch {
  state = { ...initial, annotation: null };
  /* Start fresh if browser storage cannot be read. */
}
const requestedStage = new URL(location.href).searchParams.get("stage");
if (
  requestedStage !== null &&
  String(Number(requestedStage)) === requestedStage &&
  REVIEW_STAGES[Number(requestedStage)] &&
  requestedStage !== state.stage
) {
  state.stage = requestedStage;
  state.current = "";
  state.paused = false;
  state.batch = [];
  state.draft = "";
  state.annotation = null;
}
const requestedFilter = new URL(location.href).searchParams.get("unchecked");
if (requestedFilter === "1" || requestedFilter === "0")
  state.uncheckedOnly = requestedFilter === "1";
const root = document.getElementById("app");
if (!root) throw new Error("Review root is missing");
root.innerHTML = `
<header><a href="./interior-workbench.html">← Workbench</a><span>INDOOR REVIEW</span><span id="sync" role="status">Connecting…</span></header>
<main>
  <div class="heading"><div><h1>Does this room look right?</h1><p>One key per room. Two mistakes are enough to start a fix.</p></div><label>Cases <select id="stage"><option value="all">Small → complex</option>${REVIEW_STAGES.map((s, i) => `<option value="${i}">${s}</option>`).join("")}</select></label></div>
  <label class="review-filter"><input type="checkbox" id="unchecked-only"> Unchecked only</label>
  <div class="progress"><span id="position">Preparing cases…</span><span id="counts"></span></div>
  <section class="case" id="case">
    <div class="render-panel"><h2 id="case-name">Loading atlas…</h2><div id="render-wrap"><canvas id="render" aria-label="Generated interior"></canvas></div></div>
    <aside><h2>Floor plan</h2><div id="plan" aria-label="Emoji floor plan"></div><p class="legend" id="legend">🧱 Wall　🚪 Door<br>🟫 Wood　🟦 Tile</p><p id="verdict"></p><details><summary>Sketch / case ID</summary><code id="case-id"></code><pre id="sketch"></pre></details></aside>
  </section>
  <section id="pause" hidden><h2>Ready for the next fix.</h2><p>Your two reports are captured; the save status is above. Say “ready” in chat to start the next fix—I can read saved feedback directly. Changed rooms will return for review.</p><button id="continue">Keep reviewing</button> <button id="refresh-review">Check for updates</button></section>
  <div id="actions"><p class="pin-hint">Tap a block in the render or floor plan to pin it to your report.</p><div id="pins" aria-label="Pinned blocks"></div><label class="note-label">Optional note <span>N to type · Enter to mark wrong</span><input id="note" maxlength="2000" placeholder="e.g. bottom-left corner" autocomplete="off" /></label><div class="buttons"><button id="wrong" class="wrong">Wrong <kbd>X</kbd></button><button id="good" class="good">Looks right <kbd>Space</kbd></button><button id="skip">Skip <kbd>→</kbd></button></div></div>
  <footer><button id="previous">← Previous</button><button id="undo">Undo verdict</button><button id="reload-review">Check for updates</button><span id="hint">Review judges appearance; these cases are not pre-approved.</span></footer>
  <details id="unsupported"><summary id="unsupported-label">Compiler exclusions</summary><pre id="unsupported-list"></pre></details>
</main>`;
function el<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}
const note = el<HTMLInputElement>("note");
const stage = el<HTMLSelectElement>("stage");
const canvas = el<HTMLCanvasElement>("render");
const uncheckedOnly = el<HTMLInputElement>("unchecked-only");
const cases: ReadyCase[] = reviewCases().map((c) => ({ ...c, fingerprint: "" }));
// Only the active unmarked image and one scratch canvas exist. Neither renders
// nor calculated fingerprints are persisted or reused across reloads.
const activeImage = document.createElement("canvas");
const scratch = document.createElement("canvas");
const atlas = new Image();
let assetsReady = false;
let paintedId = "";
const unsupported: string[] = [];
const excluded = new Set<string>();
let current: ReadyCase | undefined;
let syncing = false;
let storageError = false;
let navigating = false;
const history: string[] = [];

function save(): boolean {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(state));
    storageError = false;
    return true;
  } catch {
    storageError = true;
    el("sync").textContent = "Browser storage full — keep this page open until saved";
    return false;
  }
}
function pool(): ReadyCase[] {
  return cases.filter(
    (c) => !excluded.has(c.id) && (state.stage === "all" || String(c.stage) === state.stage),
  );
}
function judgment(c: ReadyCase): ReviewFeedback | undefined {
  return currentVerdict(state.records, c.id, c.fingerprint);
}
function nextCase(after?: string): ReadyCase | undefined {
  const available = pool();
  const start = Math.max(0, available.findIndex((c) => c.id === after) + 1);
  const ordered = [...available.slice(start), ...available.slice(0, start)];
  return ordered.find((c) => c.fingerprint && (!state.uncheckedOnly || !judgment(c)));
}
function show(next: ReadyCase | undefined, push = true): void {
  if (!assetsReady) return;
  if (push && current && next?.id !== current.id) history.push(current.id);
  current = next;
  if (next) state.current = next.id;
  if (state.annotation?.caseId !== next?.id || state.annotation?.fingerprint !== next?.fingerprint)
    state.annotation = null;
  save();
  draw();
}
function drawStatus(): void {
  const fresh = () => ({ reviewed: 0, unchecked: 0, checking: 0, wrong: 0 });
  const totals = [fresh(), ...REVIEW_STAGES.map(fresh)];
  for (const c of cases) {
    if (excluded.has(c.id)) continue;
    const verdict = judgment(c);
    for (const i of [0, c.stage + 1]) {
      const t = totals[i];
      if (!t) continue;
      if (!c.fingerprint) t.checking++;
      else if (!verdict) t.unchecked++;
      else {
        t.reviewed++;
        if (verdict.verdict === "wrong") t.wrong++;
      }
    }
  }
  for (const option of stage.options) {
    const i = option.value === "all" ? 0 : Number(option.value) + 1;
    const t = totals[i];
    if (!t) continue;
    const label = i === 0 ? "Small → complex" : REVIEW_STAGES[i - 1];
    const text = `${label} — ${t.unchecked} unchecked${t.checking ? ` · checking ${t.checking}` : t.unchecked === 0 ? " · ✓" : ""}${t.wrong ? ` · ${t.wrong} wrong` : ""}`;
    if (option.textContent !== text) option.textContent = text;
  }
  const t = totals[state.stage === "all" ? 0 : Number(state.stage) + 1];
  if (t)
    el("counts").textContent =
      `${t.reviewed} / ${t.reviewed + t.unchecked + t.checking} reviewed · ${t.wrong} wrong${t.checking ? ` · checking ${t.checking}` : ""}`;
  stage.value = state.stage;
  uncheckedOnly.checked = state.uncheckedOnly;
  for (const id of ["good", "wrong"]) el<HTMLButtonElement>(id).disabled = !current?.fingerprint;
  if (current) {
    const available = pool().filter((c) => !state.uncheckedOnly || (c.fingerprint && !judgment(c)));
    el("position").textContent =
      state.paused && state.uncheckedOnly
        ? `${REVIEW_STAGES[current.stage]} · Last flagged case`
        : `${REVIEW_STAGES[current.stage]} · ${available.findIndex((c) => c.id === current?.id) + 1} of ${available.length}`;
  }
}
function draw(): void {
  if (current && state.uncheckedOnly && !state.paused && judgment(current)) {
    show(nextCase(current.id), false);
    return;
  }
  drawStatus();
  const available = pool().filter((c) => !state.uncheckedOnly || !judgment(c));
  el("pause").hidden = !state.paused;
  el("actions").hidden = state.paused || !current;
  el("case").hidden = !current;
  el<HTMLButtonElement>("undo").disabled = !state.records.some((r) => r.verdict !== "clear");
  if (!current) {
    el("position").textContent = available.some((c) => !c.fingerprint)
      ? "Checking remaining cases… You can choose another category."
      : "No unchecked cases in this category. Choose another category or turn off Unchecked only to browse graded cases.";
    return;
  }
  el("case-name").textContent = current.name;
  el("legend").textContent = current.profiles
    ? `▂ Low wall · ▅ Normal wall · █ Tall wall · 🚪 Opening${current.profiles.walls.some((w) => w.thickness === "thick") ? " · Outlined = thick" : ""}`
    : "🧱 Wall · 🚪 Door · 🟫 Wood · 🟦 Tile";
  el("case-id").textContent = current.id;
  el("sketch").textContent = current.sketch;
  const plan = el("plan");
  plan.replaceChildren();
  const symbols: Record<string, string> = {
    "#": "🧱",
    "+": "🚪",
    L: "🟫",
    B: "🟫",
    H: "🟫",
    K: "🟦",
    T: "🟦",
    " ": "",
  };
  for (const [y, row] of current.sketch.split("\n").entries()) {
    const line = document.createElement("div");
    line.className = "plan-row";
    for (const [x, char] of [...row].entries()) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.setAttribute("aria-label", `Pin row ${y + 1}, column ${x + 1}`);
      cell.onclick = () => {
        addPin({ x: x * 32, y: y * 32, size: 32 }, true);
        cell.blur();
      };
      const profile = current.profiles?.walls.find((w) => w.x === x && w.y === y);
      cell.textContent = profile
        ? { low: "▂", normal: "▅", tall: "█" }[profile.height]
        : (symbols[char] ?? char);
      if (profile) {
        cell.title = `${profile.height}, ${profile.thickness ?? "thin"} wall`;
        cell.classList.toggle("thick-wall", profile.thickness === "thick");
      }
      line.append(cell);
    }
    plan.append(line);
  }
  if (paintedId !== current.id) {
    renderCase(current, activeImage);
    paintedId = current.id;
  }
  canvas.width = activeImage.width;
  canvas.height = activeImage.height;
  drawPins();
  resizeCanvas();
  const verdict = judgment(current);
  const old = [...state.records].reverse().find((r) => r.caseId === current?.id);
  el("verdict").textContent = verdict
    ? `Marked ${verdict.verdict === "good" ? "right" : "wrong"}${verdict.note ? `: ${verdict.note}` : ""}`
    : old && old.verdict !== "clear"
      ? "Changed since your last verdict — please review again."
      : "Not reviewed yet";
  note.value = state.draft;
}
function drawPins(): void {
  if (!current) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(activeImage, 0, 0);
  const pins = state.annotation?.pins ?? [];
  const list = el("pins");
  list.replaceChildren();
  for (const cell of el("plan").querySelectorAll<HTMLElement>("button")) {
    cell.classList.toggle(
      "pinned",
      pins.some(
        (p) =>
          Math.floor(p.x / 32) === Number(cell.dataset.x) &&
          Math.floor(p.y / 32) === Number(cell.dataset.y),
      ),
    );
  }
  for (const [i, pin] of pins.entries()) {
    const height = Math.min(pin.size, canvas.height - pin.y);
    ctx.strokeStyle = "#ffcf57";
    ctx.lineWidth = 1;
    ctx.strokeRect(pin.x + 0.5, pin.y + 0.5, pin.size - 1, height - 1);
    const labelY = height < 12 ? Math.max(0, pin.y - 12) : pin.y;
    ctx.fillStyle = "#ffcf57";
    ctx.fillRect(pin.x, labelY, i >= 9 ? 15 : 9, 12);
    ctx.font = "bold 10px sans-serif";
    ctx.fillStyle = "#171e2a";
    ctx.fillText(String(i + 1), pin.x + 1, labelY + 10);
    const button = document.createElement("button");
    button.textContent = `${i + 1} · R${Math.floor(pin.y / 32) + 1} C${Math.floor(pin.x / 32) + 1} ×`;
    button.setAttribute("aria-label", `Remove pin ${i + 1}`);
    button.onclick = () => {
      state.annotation?.pins.splice(i, 1);
      save();
      drawPins();
    };
    list.append(button);
  }
}
function revealPin(pin: ReviewPin): void {
  const wrap = el("render-wrap");
  const bounds = canvas.getBoundingClientRect();
  const viewport = wrap.getBoundingClientRect();
  const scale = bounds.width / canvas.width;
  wrap.scrollLeft +=
    bounds.left - viewport.left + (pin.x + pin.size / 2) * scale - wrap.clientWidth / 2;
  wrap.scrollTop +=
    bounds.top - viewport.top + (pin.y + pin.size / 2) * scale - wrap.clientHeight / 2;
}
function addPin(pin: ReviewPin, reveal = false): void {
  if (!current?.fingerprint || state.paused || navigating) return;
  state.annotation ??= { caseId: current.id, fingerprint: current.fingerprint, pins: [] };
  const pins = state.annotation.pins;
  // A double-tap should leave one pin, not toggle it back off.
  if (pins.length >= 20 || pins.some((p) => p.x === pin.x && p.y === pin.y && p.size === pin.size))
    return;
  pins.push(pin);
  save();
  drawPins();
  if (reveal) revealPin(pin);
}
canvas.addEventListener("click", (event) => {
  const bounds = canvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - bounds.left) * canvas.width) / bounds.width / 16) * 16;
  const y = Math.floor(((event.clientY - bounds.top) * canvas.height) / bounds.height / 16) * 16;
  if (x >= 0 && y >= 0 && x < canvas.width && y < canvas.height) addPin({ x, y, size: 16 });
});
function resizeCanvas(): void {
  if (!current) return;
  const wrap = el("render-wrap");
  // Compact counterexamples should fit in one phone view at native pixel
  // scale. Large apartments retain the scrollable viewport.
  wrap.style.height =
    window.matchMedia("(max-width: 700px)").matches && canvas.width <= 288 && canvas.height <= 288
      ? `${Math.max(220, canvas.height + 32)}px`
      : "";
  const width = wrap.clientWidth - 32;
  const maxHeight = el("render-wrap").clientHeight - 32;
  const scale = Math.max(
    1,
    Math.min(4, Math.floor(width / canvas.width), Math.floor(maxHeight / canvas.height)),
  );
  canvas.style.width = `${canvas.width * scale}px`;
  canvas.style.height = `${canvas.height * scale}px`;
}
async function sync(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    while (state.outbox.length) {
      const row = state.outbox[0];
      if (!row) break;
      const response = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      if (!response.ok) throw new Error("Save failed");
      state.outbox = state.outbox.filter((r) => r.id !== row.id);
      save();
    }
    const response = await fetch(API, { cache: "no-store" });
    if (!response.ok) throw new Error("Inbox unavailable");
    const remote = ((await response.json()) as unknown[]).map(parseReviewFeedback);
    // A verdict entered while GET was in flight must win over the earlier server snapshot.
    const merged = new Map(state.records.map((r) => [r.caseId, r]));
    for (const r of remote)
      if (!state.outbox.some((p) => p.caseId === r.caseId)) merged.set(r.caseId, r);
    state.records = [...merged.values(), ...state.outbox].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    save();
    el("sync").textContent = storageError
      ? "Saved to server · browser storage unavailable"
      : state.outbox.length
        ? "Saving…"
        : "Saved to server";
    if (current) draw();
  } catch {
    el("sync").textContent = storageError
      ? "Not saved — keep this page open and reconnect"
      : `Offline · ${state.outbox.length} pending · retrying automatically`;
  } finally {
    syncing = false;
  }
}
function enqueue(row: ReviewFeedback): void {
  const { screenshot: _screenshot, ...metadata } = row;
  state.records.push(metadata);
  state.outbox.push(row);
  save();
  el("sync").textContent = "Saving…";
  void sync();
}
function vote(verdict: "good" | "wrong"): void {
  if (!current?.fingerprint || state.paused || navigating) return;
  navigating = true;
  setTimeout(() => {
    navigating = false;
  }, 160);
  const voted = current;
  const row: ReviewFeedback = {
    id: crypto.randomUUID(),
    caseId: voted.id,
    fingerprint: voted.fingerprint,
    name: voted.name,
    sketch: voted.sketch,
    ...(voted.profiles ? { profiles: voted.profiles } : {}),
    verdict,
    note: note.value.trim(),
    createdAt: new Date().toISOString(),
    screenshot: canvas.toDataURL("image/png"),
    ...(state.annotation?.pins.length ? { pins: [...state.annotation.pins] } : {}),
  };
  state.draft = "";
  state.annotation = null;
  note.value = "";
  (document.activeElement as HTMLElement | null)?.blur();
  state.batch = state.batch.filter((c) => c.id !== voted.id);
  if (verdict === "wrong") state.batch.push({ id: voted.id, fingerprint: voted.fingerprint });
  state.paused = state.batch.length >= 2;
  enqueue(row);
  show(state.paused ? voted : nextCase(voted.id));
}
function undo(): void {
  const latest = [...state.records]
    .reverse()
    .find(
      (r) =>
        r.verdict !== "clear" &&
        currentVerdict(state.records, r.caseId, r.fingerprint)?.id === r.id,
    );
  if (!latest) return;
  state.paused = false;
  state.batch = state.batch.filter((c) => c.id !== latest.caseId);
  enqueue({
    ...latest,
    id: crypto.randomUUID(),
    verdict: "clear",
    createdAt: new Date().toISOString(),
  });
  const target = cases.find((c) => c.id === latest.caseId);
  if (target && state.stage !== "all" && Number(state.stage) !== target.stage)
    state.stage = String(target.stage);
  show(target);
}
el("good").onclick = () => vote("good");
el("wrong").onclick = () => vote("wrong");
el("skip").onclick = () => {
  state.draft = "";
  show(nextCase(current?.id));
};
el("previous").onclick = () => {
  while (history.length) {
    const id = history.pop();
    const target = pool().find((c) => c.id === id && (!state.uncheckedOnly || !judgment(c)));
    if (!target) continue;
    state.draft = "";
    show(target, false);
    break;
  }
};
uncheckedOnly.onchange = () => {
  state.uncheckedOnly = uncheckedOnly.checked;
  state.draft = "";
  show(state.paused ? current : nextCase());
};
el("undo").onclick = undo;
el("continue").onclick = () => {
  state.paused = false;
  state.batch = [];
  show(nextCase(current?.id));
};
el("refresh-review").onclick = () => location.reload();
el("reload-review").onclick = () => location.reload();
stage.onchange = () => {
  state.stage = stage.value;
  state.draft = "";
  state.paused = false;
  state.batch = [];
  show(nextCase());
};
note.oninput = () => {
  state.draft = note.value;
  save();
};
note.onkeydown = (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    vote("wrong");
  }
};
window.addEventListener("keydown", (event) => {
  if (
    event.repeat ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    /INPUT|TEXTAREA|SELECT|BUTTON/.test((event.target as HTMLElement).tagName)
  )
    return;
  const key = event.key.toLowerCase();
  if (
    key === " " ||
    key === "x" ||
    key === "arrowright" ||
    key === "arrowleft" ||
    key === "n" ||
    key === "backspace"
  )
    event.preventDefault();
  if (key === " ") vote("good");
  else if (key === "x") vote("wrong");
  else if (key === "arrowright" && !state.paused) el("skip").click();
  else if (key === "arrowleft") el("previous").click();
  else if (key === "n" && !state.paused) note.focus();
  else if (key === "backspace") undo();
});
window.addEventListener("resize", resizeCanvas);

function renderCase(fixture: ReviewCase, image: HTMLCanvasElement): void {
  const plan = parseFloorPlan(fixture.sketch);
  const map = fixture.profiles
    ? buildProfileApartmentPlan(plan, fixture.profiles)
    : buildLayeredApartmentPlan(plan);
  image.width = map.width * 16;
  image.height = map.pixelHeight;
  const ctx = image.getContext("2d", { willReadFrequently: image === scratch });
  if (!ctx) throw new Error("Canvas is unavailable");
  ctx.fillStyle = "#171e2a";
  ctx.fillRect(0, 0, image.width, image.height);
  drawLayeredInteriorMap(ctx, atlas, map);
}
// A real task boundary (not a resolved Promise) gives input and painting a turn.
const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
async function verifyCase(c: ReadyCase): Promise<void> {
  if (c.fingerprint || excluded.has(c.id)) return;
  await yieldToBrowser();
  try {
    renderCase(c, scratch);
    const ctx = scratch.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable");
    const pixels = ctx.getImageData(0, 0, scratch.width, scratch.height).data;
    const header = new TextEncoder().encode(`${c.sketch}\n${scratch.width},${scratch.height}\n`);
    const bytes = new Uint8Array(header.length + pixels.length);
    bytes.set(header);
    bytes.set(pixels, header.length);
    c.fingerprint = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (error) {
    excluded.add(c.id);
    unsupported.push(`${c.id} · ${c.name}\n${String(error)}\n${c.sketch}`);
    el("unsupported-label").textContent = `${unsupported.length} cases excluded by the compiler`;
    el("unsupported-list").textContent = unsupported.join("\n\n");
    el("unsupported").hidden = false;
  }
  drawStatus();
  if (!current)
    el("position").textContent =
      `Checking cases… ${cases.filter((c) => c.fingerprint).length} / ${cases.length}`;
  if (current?.id === c.id) draw();
  else if (
    el("app").dataset.reviewReady &&
    !current &&
    !state.paused &&
    pool().includes(c) &&
    !excluded.has(c.id) &&
    (!state.uncheckedOnly || !judgment(c))
  )
    show(c, false);
}
async function findUnchecked(): Promise<ReadyCase | undefined> {
  // Existing reports and unreviewed cases go first; approved cases are checked
  // afterward. All judgments still use freshly rendered pixels.
  const candidates = pool();
  const records = new Map(state.records.map((r) => [r.caseId, r]));
  const priority = (c: ReadyCase) => (records.get(c.id)?.verdict === "good" ? 1 : 0);
  if (state.uncheckedOnly) candidates.sort((a, b) => priority(a) - priority(b));
  for (const c of candidates) {
    await verifyCase(c);
    if (!excluded.has(c.id) && (!state.uncheckedOnly || !judgment(c))) return c;
  }
}
async function start(): Promise<void> {
  drawStatus();
  el("actions").hidden = true;
  el("unsupported").hidden = true;
  el("unsupported-label").textContent = "0 cases excluded by the compiler";
  atlas.src = spriteUrl;
  // Source image, small index, and feedback can travel in parallel.
  await Promise.all([loadModernInteriorsAtlasIndex(spriteIndexUrl), atlas.decode(), sync()]);
  assetsReady = true;
  el("case-name").textContent = "Checking current renders…";
  let changed: ReadyCase | undefined;
  for (const c of cases.filter((c) => state.batch.some((b) => b.id === c.id))) {
    await verifyCase(c);
    if (c.fingerprint && state.batch.some((b) => b.id === c.id && b.fingerprint !== c.fingerprint))
      changed ??= c;
  }
  const reduction = changed && cases.find((c) => c.relatedCaseId === changed.id);
  if (reduction) await verifyCase(reduction);
  if (changed) {
    state.paused = false;
    state.batch = [];
    state.stage = "all";
    state.draft = "";
  }
  const restored = pool().find((c) => c.id === state.current);
  if (restored) await verifyCase(restored);
  let target =
    (reduction && !judgment(reduction) ? reduction : undefined) ??
    changed ??
    (restored &&
    !excluded.has(restored.id) &&
    (state.paused || !state.uncheckedOnly || !judgment(restored))
      ? restored
      : undefined) ??
    (await findUnchecked());
  if (!target && state.stage !== "all") {
    state.stage = "all";
    target = await findUnchecked();
  }
  show(target ?? (!state.uncheckedOnly ? restored : undefined), false);
  el("app").dataset.reviewReady = "true";
  // Revalidate everything for exact category counts, without storing images or
  // blocking review. Navigation changes the priority of the next scratch render.
  while (cases.some((c) => !c.fingerprint && !excluded.has(c.id))) {
    const pending = (c: ReadyCase) => !c.fingerprint && !excluded.has(c.id);
    const next =
      (current && pending(current) ? current : undefined) ??
      pool().find(pending) ??
      cases.find(pending);
    if (!next) break;
    await verifyCase(next);
  }
  scratch.width = scratch.height = 0;
  if (current) drawStatus();
  else draw();
  el("app").dataset.ready = "true";
  setInterval(() => void sync(), 5000);
}
void start().catch((error) => {
  el("case-name").textContent = String(error);
  el("sync").textContent = "Could not load review";
});
