import { loadModernInteriorsAtlasIndex } from "../../assets/ModernInteriorsAtlasIndex.js";
import { buildLayeredApartmentPlan } from "../ApartmentArchitecture.js";
import { parseFloorPlan } from "../ApartmentFloorPlan.js";
import { drawLayeredInteriorMap } from "../LayeredInteriorMap.js";
import { REVIEW_STAGES, type ReviewCase, reviewCases } from "./ReviewCases.js";
import { currentVerdict, parseReviewFeedback, type ReviewFeedback } from "./ReviewFeedback.js";
import "./review.css";

const STORAGE = "tilefun.indoor-review.v1";
const API = "/tilefun/api/interior-review";
interface ReadyCase extends ReviewCase {
  fingerprint: string;
  image: HTMLCanvasElement;
}
interface State {
  current: string;
  stage: string;
  records: ReviewFeedback[];
  outbox: ReviewFeedback[];
  batch: { id: string; fingerprint: string }[];
  paused: boolean;
  draft: string;
}
const initial: State = {
  current: "",
  stage: "all",
  records: [],
  outbox: [],
  batch: [],
  paused: false,
  draft: "",
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
      records: saved.records.map(parseReviewFeedback),
      outbox: saved.outbox.map(parseReviewFeedback),
    };
  }
} catch {
  /* Start fresh if browser storage cannot be read. */
}
const root = document.getElementById("app");
if (!root) throw new Error("Review root is missing");
root.innerHTML = `
<header><a href="./interior-workbench.html">← Workbench</a><span>INDOOR REVIEW</span><span id="sync" role="status">Connecting…</span></header>
<main>
  <div class="heading"><div><h1>Does this room look right?</h1><p>One key per room. Two mistakes are enough to start a fix.</p></div><label>Cases <select id="stage"><option value="all">Small → complex</option>${REVIEW_STAGES.map((s, i) => `<option value="${i}">${s}</option>`).join("")}</select></label></div>
  <div class="progress"><span id="position">Preparing cases…</span><span id="counts"></span></div>
  <section class="case" id="case">
    <div class="render-panel"><h2 id="case-name">Loading atlas…</h2><div id="render-wrap"><canvas id="render" aria-label="Generated interior"></canvas></div></div>
    <aside><h2>Floor plan</h2><div id="plan" aria-label="Emoji floor plan"></div><p class="legend">🧱 Wall　🚪 Door<br>🟫 Wood　🟦 Tile</p><p id="verdict"></p><details><summary>Sketch / case ID</summary><code id="case-id"></code><pre id="sketch"></pre></details></aside>
  </section>
  <section id="pause" hidden><h2>Ready for the next fix.</h2><p>Your two reports are captured; the save status is above. Say “ready” in chat to start the next fix—I can read saved feedback directly. Changed rooms will return for review.</p><button id="continue">Keep reviewing</button> <button id="refresh-review">Check for updates</button></section>
  <div id="actions"><label class="note-label">Optional note <span>N to type · Enter to mark wrong</span><input id="note" maxlength="2000" placeholder="e.g. bottom-left corner" autocomplete="off" /></label><div class="buttons"><button id="wrong" class="wrong">Wrong <kbd>X</kbd></button><button id="good" class="good">Looks right <kbd>Space</kbd></button><button id="skip">Skip <kbd>→</kbd></button></div></div>
  <footer><button id="previous">← Previous</button><button id="undo">Undo verdict</button><span id="hint">Review judges appearance; these cases are not pre-approved.</span></footer>
  <details id="unsupported"><summary id="unsupported-label">Compiler exclusions</summary><pre id="unsupported-list"></pre></details>
</main>`;
function el<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}
const note = el<HTMLInputElement>("note");
const stage = el<HTMLSelectElement>("stage");
const canvas = el<HTMLCanvasElement>("render");
const cases: ReadyCase[] = [];
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
  return cases.filter((c) => state.stage === "all" || String(c.stage) === state.stage);
}
function judgment(c: ReadyCase): ReviewFeedback | undefined {
  return currentVerdict(state.records, c.id, c.fingerprint);
}
function nextCase(after?: string): ReadyCase | undefined {
  const available = pool();
  const start = Math.max(0, available.findIndex((c) => c.id === after) + 1);
  const ordered = [...available.slice(start), ...available.slice(0, start)];
  return ordered.find((c) => !judgment(c));
}
function show(next: ReadyCase | undefined, push = true): void {
  if (push && current && next?.id !== current.id) history.push(current.id);
  current = next;
  if (next) state.current = next.id;
  save();
  draw();
}
function draw(): void {
  const available = pool();
  const reviewed = available.filter((c) => judgment(c));
  el("counts").textContent =
    `${reviewed.length} / ${available.length} reviewed · ${reviewed.filter((c) => judgment(c)?.verdict === "wrong").length} wrong`;
  stage.value = state.stage;
  el("pause").hidden = !state.paused;
  el("actions").hidden = state.paused || !current;
  el("case").hidden = !current;
  el<HTMLButtonElement>("undo").disabled = !state.records.some((r) => r.verdict !== "clear");
  if (!current) {
    el("position").textContent =
      "All current renders in this set reviewed. Choose another set or revisit Previous.";
    return;
  }
  el("position").textContent =
    `${REVIEW_STAGES[current.stage]} · ${available.findIndex((c) => c.id === current?.id) + 1} of ${available.length}`;
  el("case-name").textContent = current.name;
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
  for (const row of current.sketch.split("\n")) {
    const line = document.createElement("div");
    line.className = "plan-row";
    for (const char of row) {
      const cell = document.createElement("span");
      cell.textContent = symbols[char] ?? char;
      line.append(cell);
    }
    plan.append(line);
  }
  canvas.width = current.image.width;
  canvas.height = current.image.height;
  canvas.getContext("2d")?.drawImage(current.image, 0, 0);
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
function resizeCanvas(): void {
  if (!current) return;
  const width = el("render-wrap").clientWidth - 32;
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
  if (!current || state.paused || navigating) return;
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
    verdict,
    note: note.value.trim(),
    createdAt: new Date().toISOString(),
    screenshot: voted.image.toDataURL("image/png"),
  };
  state.draft = "";
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
  const id = history.pop();
  if (id) {
    state.draft = "";
    show(
      cases.find((c) => c.id === id),
      false,
    );
  }
};
el("undo").onclick = undo;
el("continue").onclick = () => {
  state.paused = false;
  state.batch = [];
  show(nextCase(current?.id));
};
el("refresh-review").onclick = () => location.reload();
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

async function start(): Promise<void> {
  await loadModernInteriorsAtlasIndex();
  const atlas = new Image();
  atlas.src = "assets/tilesets/modern-interiors-atlas.png";
  await atlas.decode();
  const unsupported: string[] = [];
  for (const fixture of reviewCases()) {
    try {
      const map = buildLayeredApartmentPlan(parseFloorPlan(fixture.sketch));
      const image = document.createElement("canvas");
      image.width = map.width * 16;
      image.height = map.pixelHeight;
      const context = image.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      context.fillStyle = "#171e2a";
      context.fillRect(0, 0, image.width, image.height);
      drawLayeredInteriorMap(context, atlas, map);
      // Hash final pixels plus plan and dimensions, independent of display zoom or code revision.
      const pixels = context.getImageData(0, 0, image.width, image.height).data;
      const header = new TextEncoder().encode(
        `${fixture.sketch}\n${image.width},${image.height}\n`,
      );
      const bytes = new Uint8Array(header.length + pixels.length);
      bytes.set(header);
      bytes.set(pixels, header.length);
      const fingerprint = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      cases.push({ ...fixture, image, fingerprint });
    } catch (error) {
      unsupported.push(`${fixture.id} · ${fixture.name}\n${String(error)}\n${fixture.sketch}`);
    }
  }
  el("unsupported-label").textContent = `${unsupported.length} cases excluded by the compiler`;
  el("unsupported-list").textContent = unsupported.join("\n\n");
  el("unsupported").hidden = unsupported.length === 0;
  await sync();
  const changed = cases.find((c) =>
    state.batch.some((b) => b.id === c.id && b.fingerprint !== c.fingerprint),
  );
  if (changed) {
    state.paused = false;
    state.batch = [];
    state.stage = "all";
    state.draft = "";
  }
  const restored = pool().find((c) => c.id === state.current);
  show(
    changed ??
      (restored && (state.paused || state.draft || !judgment(restored)) ? restored : undefined) ??
      nextCase() ??
      restored,
    false,
  );
  el("app").dataset.ready = "true";
  setInterval(() => void sync(), 5000);
}
void start().catch((error) => {
  el("case-name").textContent = String(error);
  el("sync").textContent = "Could not load review";
});
