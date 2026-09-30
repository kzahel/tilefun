import "./art.css";
import { loadJSON } from "../assets/AssetLoader.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import {
  CITY_BUILDING_PREFABS,
  CITY_PREFAB_SOURCE,
  cityPrefabBlock,
  resolveCityPrefabType,
} from "../generation/regional/CityBuildingPrefabs.js";
import { type ArtCatalog, type ArtRect, required } from "./ArtCatalog.js";
import { ArtNoteInbox } from "./ArtNoteInbox.js";
import type { ArtNote, BuildingReview } from "./ArtNotes.js";
import { loadVerifiedArtImage, sha256 } from "./ArtSource.js";
import { drawBuildingShowcase } from "./BuildingShowcase.js";

const $ = <T extends HTMLElement>(id: string) => required(document.getElementById(id)) as T;
const scene = $<HTMLSelectElement>("scene"),
  select = $<HTMLSelectElement>("prefab"),
  canvas = $<HTMLCanvasElement>("building");
const params = new URLSearchParams(location.search);
select.replaceChildren(...CITY_BUILDING_PREFABS.map((p) => new Option(p.name, p.type)));
const requestedType = params.get("prefab") ?? "";
const resolvedType = resolveCityPrefabType(requestedType);
if (CITY_BUILDING_PREFABS.some((p) => p.type === resolvedType)) select.value = resolvedType;
if (["single", "residential", "mixed", "hotel"].includes(params.get("scene") ?? ""))
  scene.value = params.get("scene") ?? "single";
const catalog = await loadJSON<ArtCatalog>("data/art-catalog.json");
const source = required(catalog.sheets.find((s) => s.id === CITY_PREFAB_SOURCE.sheetId));
const inbox = new ArtNoteInbox(catalog, "tilefun.building-feedback.v1");
const noteInput = $<HTMLTextAreaElement>("building-note");
const target = $<HTMLSelectElement>("feedback-target");
const save = $<HTMLButtonElement>("save-building-note");
let placements: ReturnType<typeof cityPrefabBlock> = [];
let verified = false;
let sending = false;
let draftKey = "";
let feedbackScene = "";
let drafts: Record<string, string> = {};
try {
  const stored = JSON.parse(localStorage.getItem("tilefun.building-drafts.v1") ?? "{}");
  if (stored && typeof stored === "object" && !Array.isArray(stored))
    drafts = Object.fromEntries(
      Object.entries(stored).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
} catch {
  /* Ignore invalid drafts. */
}
function persistDrafts() {
  try {
    localStorage.setItem("tilefun.building-drafts.v1", JSON.stringify(drafts));
  } catch {
    $("feedback-sync").textContent =
      "Draft storage is full. Keep this page open until feedback is saved.";
  }
}
function currentTarget() {
  const prefabs =
    target.value === "block"
      ? placements.map((p) => p.prefab)
      : [required(placements.find((p) => p.prefab.type === target.value)).prefab];
  const kind = target.value === "block" ? (scene.value as BuildingReview["scene"]) : "single";
  const url = new URL("building-lab.html", location.href);
  url.searchParams.set("scene", kind);
  url.searchParams.set("prefab", required(prefabs[0]).type);
  const parts = prefabs.flatMap((p) => p.parts);
  const x = Math.min(...parts.map((p) => p.frameCol * 16));
  const y = Math.min(...parts.map((p) => p.frameRow * 16));
  const ex = Math.max(...parts.map((p) => p.frameCol * 16 + p.spriteWidth));
  const ey = Math.max(...parts.map((p) => p.frameRow * 16 + p.spriteHeight));
  return {
    prefabs,
    scene: kind,
    url: url.pathname + url.search,
    rect: [x, y, ex - x, ey - y] as ArtRect,
  };
}
function updateFeedbackTarget() {
  const context = currentTarget();
  draftKey = `${context.scene}:${context.prefabs.map((p) => p.type).join(",")}`;
  noteInput.value = typeof drafts[draftKey] === "string" ? required(drafts[draftKey]) : "";
  $("feedback-context").textContent =
    `Saved with this ${context.scene === "single" ? "building" : "block"}, its recipe IDs, and source revision. I can read it from the shared inbox.`;
  save.disabled = !verified || sending;
}
function renderFeedbackNotes() {
  $("feedback-sync").textContent = inbox.status;
  const container = $("building-notes");
  container.replaceChildren();
  const rows = inbox.notes.filter((r) => r.buildingReview).reverse();
  if (!rows.length) container.textContent = "No building feedback yet.";
  for (const row of rows.slice(0, 30)) {
    const article = document.createElement("article");
    article.dataset.thread = row.threadId;
    const heading = document.createElement("a");
    heading.href = required(row.buildingReview).url;
    heading.textContent = `${row.status} · ${required(row.buildingReview).scene} · ${required(row.buildingReview).prefabIds.join(", ")}`;
    const body = document.createElement("p");
    body.textContent = row.note;
    article.append(heading, body);
    if (row.reply) {
      const reply = document.createElement("p");
      reply.textContent = `Reply: ${row.reply}`;
      article.append(reply);
    }
    if (inbox.outbox.some((n) => n.threadId === row.threadId)) {
      const pending = document.createElement("p");
      pending.textContent = "Pending server save";
      article.append(pending);
    }
    const review = required(row.buildingReview);
    const current = review.prefabIds.map((id) =>
      CITY_BUILDING_PREFABS.find((p) => p.type === resolveCityPrefabType(id)),
    );
    if (current.every((p) => p !== undefined))
      void sha256(new TextEncoder().encode(JSON.stringify(current))).then((revision) => {
        if (revision !== review.revision) {
          const changed = document.createElement("p");
          changed.className = "muted";
          changed.textContent =
            "Composition changed since this note. The link opens the current candidate.";
          article.append(changed);
        }
      });
    container.append(article);
  }
}
inbox.onchange = renderFeedbackNotes;
noteInput.oninput = () => {
  drafts[draftKey] = noteInput.value;
  persistDrafts();
};
target.onchange = updateFeedbackTarget;
$("building-note-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!verified || sending || !noteInput.value.trim()) return;
  const context = currentTarget(),
    note = noteInput.value.trim(),
    key = draftKey;
  sending = true;
  save.disabled = true;
  void (async () => {
    try {
      const revision = await sha256(new TextEncoder().encode(JSON.stringify(context.prefabs)));
      const id = crypto.randomUUID();
      const row: ArtNote = {
        id,
        threadId: id,
        sheetId: source.id,
        fingerprint: source.fingerprint,
        sheetSize: [source.width, source.height],
        rect: context.rect,
        sliceKeys: [],
        intent: "building",
        status: "pending",
        note,
        reply: "",
        createdAt: new Date().toISOString(),
        buildingReview: {
          scene: context.scene,
          prefabIds: context.prefabs.map((p) => p.type),
          revision,
          url: context.url,
        },
      };
      inbox.enqueue(row);
      if (drafts[key]?.trim() === note) delete drafts[key];
      if (key === draftKey && noteInput.value.trim() === note) noteInput.value = "";
      persistDrafts();
      $<HTMLDetailsElement>("building-feedback-history").open = true;
    } catch (error) {
      $("feedback-sync").textContent =
        `Could not queue feedback: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      sending = false;
      save.disabled = !verified;
    }
  })();
});
$("refresh-building-notes").onclick = () => void inbox.sync();
window.addEventListener("online", () => void inbox.sync());
setInterval(() => {
  if (inbox.outbox.length) void inbox.sync();
}, 15000);
renderFeedbackNotes();
void inbox.sync();
let sheet: Spritesheet;
try {
  if (source.fingerprint !== CITY_PREFAB_SOURCE.fingerprint)
    throw new Error(
      "Building recipes reference a different source revision. Update the recipes before reviewing.",
    );
  sheet = new Spritesheet(await createImageBitmap(await loadVerifiedArtImage(source)), 16, 16);
  verified = true;
} catch (error) {
  $("loading").textContent = error instanceof Error ? error.message : String(error);
  $("feedback-sync").textContent = "Feedback is disabled until the preview source is verified.";
  throw error;
}
function render() {
  let prefab = required(CITY_BUILDING_PREFABS.find((p) => p.type === select.value));
  placements =
    scene.value === "single"
      ? [{ prefab, wx: 0, wy: 0 }]
      : cityPrefabBlock(scene.value as "residential" | "mixed" | "hotel");
  if (!placements.some((p) => p.prefab.type === prefab.type)) {
    prefab = required(placements[0]).prefab;
    select.value = prefab.type;
  }
  const stats = drawBuildingShowcase(
    canvas,
    placements,
    sheet,
    $<HTMLInputElement>("geometry").checked,
  );
  const scale = $<HTMLSelectElement>("scale").value;
  canvas.style.width =
    scale === "fit"
      ? `min(100%, ${stats.width * 2}px)`
      : `${stats.width * (scale === "large" ? 2 : 1)}px`;
  $("loading").textContent = "";
  $("name").textContent =
    scene.value === "single"
      ? prefab.name
      : `${scene.selectedOptions[0]?.textContent} · ${placements.length} prefabs`;
  $("facts").textContent =
    `${stats.width}×${stats.height} native stage pixels · ${stats.parts} shared sprite pieces${scene.value === "single" ? ` · footprint ${prefab.width}×${prefab.groundDepth}` : ""}`;
  $("recipe-id").textContent = prefab.type;
  $("assembly-summary").textContent =
    scene.value === "single"
      ? `Complete facade · both ends closed · ${prefab.topology.modules.length} connected section(s) · shared roof datum`
      : "Complete building assemblies with closed exterior ends and independently assembled roof decks.";
  $("bookmark-notice").textContent =
    requestedType !== resolvedType && select.value === resolvedType
      ? "The old storefront-only link now shows a complete building with apartments and a residential entrance."
      : "";
  const topology = $("topology");
  topology.replaceChildren();
  for (const m of prefab.topology.modules) {
    const row = document.createElement("p");
    row.textContent = `${m.id}: ${m.width}px · left ${m.left === "closed" ? "closed end" : "attachment"} · right ${m.right === "closed" ? "closed end" : "attachment"}`;
    topology.append(row);
  }
  const roofRow = document.createElement("p");
  roofRow.textContent = `Roof deck: ${prefab.topology.roof.depth}px deep; all sections share a base ${Math.abs(prefab.topology.roof.datum)}px above the street.`;
  topology.append(roofRow);
  const sourceUrl = new URL("art-workbench.html", location.href);
  sourceUrl.searchParams.set("sheet", CITY_PREFAB_SOURCE.sheetId);
  const xs = prefab.parts.map((p) => p.frameCol * 16),
    ys = prefab.parts.map((p) => p.frameRow * 16);
  const x = Math.min(...xs),
    y = Math.min(...ys),
    ex = Math.max(...prefab.parts.map((p) => p.frameCol * 16 + p.spriteWidth)),
    ey = Math.max(...prefab.parts.map((p) => p.frameRow * 16 + p.spriteHeight));
  sourceUrl.searchParams.set("rect", [x, y, ex - x, ey - y].join(","));
  $<HTMLAnchorElement>("source-link").href = sourceUrl.href;
  const picks = $("block-buildings");
  picks.replaceChildren();
  for (const p of placements) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = p.prefab.name;
    button.onclick = () => {
      select.value = p.prefab.type;
      scene.value = "single";
      render();
    };
    picks.append(button);
  }
  const pieces = $("pieces");
  pieces.replaceChildren();
  for (const p of prefab.parts) {
    const row = document.createElement("p");
    row.textContent = `Source [${p.frameCol * 16}, ${p.frameRow * 16}, ${p.spriteWidth}, ${p.spriteHeight}] → center ${p.dx}, bottom ${p.dy}`;
    pieces.append(row);
  }
  const url = new URL(location.href);
  url.searchParams.set("scene", scene.value);
  url.searchParams.set("prefab", prefab.type);
  history.replaceState(null, "", url);
  $("app").dataset.ready = "true";
  canvas.dataset.parts = String(stats.parts);
  canvas.dataset.prefabs = String(placements.length);
  const previousTarget = feedbackScene === scene.value ? target.value : "";
  target.replaceChildren(
    ...(scene.value === "single" ? [] : [new Option("Whole block", "block")]),
    ...placements.map((p) => new Option(p.prefab.name, p.prefab.type)),
  );
  if ([...target.options].some((option) => option.value === previousTarget))
    target.value = previousTarget;
  feedbackScene = scene.value;
  updateFeedbackTarget();
}
for (const control of [scene, $("geometry"), $("scale")])
  control.addEventListener("change", render);
select.addEventListener("change", () => {
  scene.value = "single";
  render();
});
render();
