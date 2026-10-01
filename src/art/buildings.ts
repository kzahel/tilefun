import "./art.css";
import "./buildings.css";
import { loadJSON } from "../assets/AssetLoader.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { createProp, PROP_PALETTE } from "../entities/PropFactories.js";
import {
  CITY_BUILDING_PREFABS,
  CITY_PREFAB_SOURCE,
  cityPrefabBlock,
  type HotelSign,
  hotelPrefabType,
  resolveCityPrefabType,
} from "../generation/regional/CityBuildingPrefabs.js";
import { STREET_REVIEW_SCENES, type StreetScene } from "../generation/regional/StreetRecipes.js";
import {
  CITY_SURFACE_CASES,
  CITY_SURFACE_SOURCE,
  citySurfaceComposition,
  composeCitySurface,
} from "../road/CitySurfaceRecipes.js";
import { type ArtCatalog, type ArtRect, required } from "./ArtCatalog.js";
import { ArtNoteInbox } from "./ArtNoteInbox.js";
import type { ArtNote, BuildingReview, BuildingVerdict } from "./ArtNotes.js";
import { loadVerifiedArtImage, sha256 } from "./ArtSource.js";
import { buildingCaseKey, currentBuildingVerdict } from "./BuildingReviewQueue.js";
import { drawBuildingShowcase } from "./BuildingShowcase.js";
import { drawStreetShowcase } from "./StreetShowcase.js";
import { drawSurfaceShowcase } from "./SurfaceShowcase.js";

const $ = <T extends HTMLElement>(id: string) => required(document.getElementById(id)) as T;
const scene = $<HTMLSelectElement>("scene"),
  select = $<HTMLSelectElement>("prefab"),
  hotelSign = $<HTMLSelectElement>("hotel-sign"),
  canvas = $<HTMLCanvasElement>("building");
const params = new URLSearchParams(location.search);
const streetRun = params.get("run") === "streets";
const surfaceRun = params.get("run") === "surfaces";
const reviewStorage = surfaceRun
  ? "tilefun.surface-review.v1"
  : streetRun
    ? "tilefun.street-review.v1"
    : "tilefun.building-review.v1";
const surfaceSelect = $<HTMLSelectElement>("surface-case");
surfaceSelect.replaceChildren(...CITY_SURFACE_CASES.map((s) => new Option(s.name, s.id)));
if (CITY_SURFACE_CASES.some((s) => s.id === params.get("case")))
  surfaceSelect.value = params.get("case") ?? "";
function currentSurface() {
  return required(CITY_SURFACE_CASES.find((s) => s.id === surfaceSelect.value));
}
const streetSelect = $<HTMLSelectElement>("street-case");
streetSelect.replaceChildren(...STREET_REVIEW_SCENES.map((s) => new Option(s.name, s.id)));
if (STREET_REVIEW_SCENES.some((s) => s.id === params.get("case")))
  streetSelect.value = params.get("case") ?? "";
function currentStreet(): StreetScene {
  return required(STREET_REVIEW_SCENES.find((s) => s.id === streetSelect.value));
}
function streetComposition(s: StreetScene) {
  return {
    scene: s,
    building: required(CITY_BUILDING_PREFABS.find((p) => p.type === s.buildingType)),
    props: s.props.map((p) => createProp(p.type, p.wx, p.wy)),
  };
}
function reviewSourceRects(
  prefabs: readonly (typeof CITY_BUILDING_PREFABS)[number][],
  street?: StreetScene,
): ArtRect[] {
  return [
    ...prefabs.flatMap((p) =>
      p.parts.map(
        (s) => [s.frameCol * 16, s.frameRow * 16, s.spriteWidth, s.spriteHeight] as ArtRect,
      ),
    ),
    ...(street?.props.map((p) => {
      const s = createProp(p.type, p.wx, p.wy).sprite;
      return [s.frameCol * 16, s.frameRow * 16, s.spriteWidth, s.spriteHeight] as ArtRect;
    }) ?? []),
  ];
}
if (streetRun) {
  scene.add(new Option("Street starter", "street"));
  scene.value = "street";
  $("scene-options").hidden = true;
  $("prefab-options").hidden = true;
  $("street-options").hidden = false;
  required(document.querySelector(".building-intro h1")).textContent =
    "Review the street starter palette.";
  required(document.querySelector(".building-intro p")).textContent =
    "Street-level views: approve the props and spacing. Two reports pause until “ready” in chat.";
  canvas.setAttribute("aria-label", "Street furniture scene");
}
if (surfaceRun) {
  scene.add(new Option("Road foundation", "surface"));
  scene.value = "surface";
  $("scene-options").hidden = true;
  $("prefab-options").hidden = true;
  $("surface-options").hidden = false;
  required(document.querySelector(".building-intro h1")).textContent =
    "Review the road foundation.";
  required(document.querySelector(".building-intro p")).textContent =
    "Road widths, curbs, crossings & dividers. Two reports pause until “ready” in chat.";
  canvas.setAttribute("aria-label", "Road foundation scene");
  document.title = "Road foundation review · Tilefun";
  required(document.querySelector(".brand span")).textContent = "/ Road foundation";
  required($("building-feedback-history").querySelector("summary")).textContent =
    "Art feedback & replies (all scenes)";
  $("preview-explanation").textContent =
    "Source-backed surface candidates. Review this base canvas before building dense city blocks on it.";
  required(required($("geometry").parentElement).lastChild).textContent = "Tile grid";
}
select.replaceChildren(...CITY_BUILDING_PREFABS.map((p) => new Option(p.name, p.type)));
const requestedType = params.get("prefab") ?? "";
const resolvedType = resolveCityPrefabType(requestedType);
if (CITY_BUILDING_PREFABS.some((p) => p.type === resolvedType)) select.value = resolvedType;
if (
  !streetRun &&
  !surfaceRun &&
  ["single", "residential", "mixed", "hotel"].includes(params.get("scene") ?? "")
)
  scene.value = params.get("scene") ?? "single";
const catalog = await loadJSON<ArtCatalog>("data/art-catalog.json");
const source = required(catalog.sheets.find((s) => s.id === CITY_PREFAB_SOURCE.sheetId));
const inbox = new ArtNoteInbox(catalog, "tilefun.building-feedback.v1");
const noteInput = $<HTMLTextAreaElement>("building-note");
const target = $<HTMLSelectElement>("feedback-target");
const save = $<HTMLButtonElement>("save-building-note");
let placements: ReturnType<typeof cityPrefabBlock> = [];
let verified = false;
let queueReady = false;
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
function currentTarget(displayed = false) {
  const whole = surfaceRun || streetRun || displayed || target.value === "block";
  const prefabs = surfaceRun
    ? []
    : whole
      ? placements.map((p) => p.prefab)
      : [required(placements.find((p) => p.prefab.type === target.value)).prefab];
  const kind = surfaceRun
    ? "surface"
    : streetRun
      ? "street"
      : whole
        ? (scene.value as BuildingReview["scene"])
        : "single";
  const street = streetRun ? currentStreet() : undefined;
  const url = new URL("building-lab.html", location.href);
  url.searchParams.set("scene", kind);
  if (prefabs[0]) url.searchParams.set("prefab", prefabs[0].type);
  if (street) {
    url.search = "";
    url.searchParams.set("run", "streets");
    url.searchParams.set("case", street.id);
  }
  const surface = surfaceRun ? currentSurface() : undefined;
  if (surface) {
    url.search = "";
    url.searchParams.set("run", "surfaces");
    url.searchParams.set("case", surface.id);
  }
  const rects = surface
    ? composeCitySurface(surface).map((p) => p.rect)
    : reviewSourceRects(prefabs, street);
  const x = Math.min(...rects.map((p) => p[0])),
    y = Math.min(...rects.map((p) => p[1]));
  const ex = Math.max(...rects.map((p) => p[0] + p[2])),
    ey = Math.max(...rects.map((p) => p[1] + p[3]));
  return {
    prefabs,
    street,
    surface,
    scene: kind,
    url: url.pathname + url.search,
    rect: [x, y, ex - x, ey - y] as ArtRect,
  };
}
function updateFeedbackTarget() {
  const context = currentTarget();
  noteInput.setCustomValidity("");
  draftKey = context.surface
    ? `surface:${context.surface.id}`
    : context.street
      ? `street:${context.street.id}`
      : `${context.scene}:${context.prefabs.map((p) => p.type).join(",")}`;
  noteInput.value = typeof drafts[draftKey] === "string" ? required(drafts[draftKey]) : "";
  $("feedback-context").textContent =
    `Saved with this ${context.surface ? "road scene" : context.street ? "street scene" : context.scene === "single" ? "building" : "block"}, its recipe IDs, and source revision. I can read it from the shared inbox.`;
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
    heading.textContent = `${row.buildingVerdict ? `${row.buildingVerdict.value === "clear" ? "reopened" : row.buildingVerdict.value} · ` : ""}${row.status} · ${required(row.buildingReview).caseId ?? required(row.buildingReview).scene} · ${required(row.buildingReview).surfaceRecipe ?? required(row.buildingReview).prefabIds.join(", ")}`;
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
    if (
      review.scene !== "surface" &&
      review.scene !== "street" &&
      current.every((p) => p !== undefined)
    )
      void sha256(new TextEncoder().encode(JSON.stringify(current))).then((revision) => {
        if (revision !== review.revision) {
          const changed = document.createElement("p");
          changed.className = "muted";
          changed.textContent =
            "Composition changed since this note. The link opens the current candidate.";
          article.append(changed);
        }
      });
    if ((review.scene === "street" || review.scene === "surface") && queueReady) {
      const candidate = candidates.find((c) => c.key === buildingCaseKey(review));
      if (candidate && candidate.review.revision !== review.revision) {
        const changed = document.createElement("p");
        changed.textContent =
          "Scene changed since this note. The link opens the current candidate.";
        article.append(changed);
      }
    }
    container.append(article);
  }
}
inbox.onchange = () => {
  renderFeedbackNotes();
  if (queueReady) updateQueue();
};
noteInput.oninput = () => {
  noteInput.setCustomValidity("");
  drafts[draftKey] = noteInput.value;
  persistDrafts();
};
target.onchange = () => {
  if (scene.value !== "single" && target.value !== "block") {
    select.value = target.value;
    scene.value = "single";
    showSelection();
  } else updateFeedbackTarget();
};
async function saveFeedback(verdict?: BuildingVerdict["value"]) {
  if (!verified || sending || (paused && verdict !== "clear")) return;
  if ((!verdict || verdict === "changes") && !noteInput.value.trim()) {
    noteInput.setCustomValidity("Please leave a reason for the changes.");
    noteInput.reportValidity();
    noteInput.focus();
    return;
  }
  const context = currentTarget(!!verdict),
    note =
      noteInput.value.trim() ||
      (verdict === "approved" ? "Approved this candidate." : "Reopened for review."),
    key = draftKey;
  sending = true;
  updateQueue();
  try {
    const revision = await sha256(
      new TextEncoder().encode(
        JSON.stringify(
          context.surface
            ? citySurfaceComposition(context.surface)
            : context.street
              ? streetComposition(context.street)
              : context.prefabs,
        ),
      ),
    );
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const candidate = candidates.find(
      (c) =>
        c.key ===
        buildingCaseKey({
          scene: context.scene,
          prefabIds: context.prefabs.map((p) => p.type),
          ...(context.surface
            ? { caseId: context.surface.id }
            : context.street
              ? { caseId: context.street.id }
              : {}),
        }),
    );
    const row: ArtNote = {
      id,
      threadId: id,
      sheetId: source.id,
      fingerprint: source.fingerprint,
      sheetSize: [source.width, source.height],
      rect: context.rect,
      sliceKeys: [],
      intent: context.surface ? "terrain" : context.street ? "pattern" : "building",
      status: verdict === "approved" || verdict === "clear" ? "resolved" : "pending",
      note,
      reply: "",
      createdAt,
      buildingReview: {
        scene: context.scene,
        ...(context.street
          ? {
              caseId: context.street.id,
              propTypes: [...new Set(context.street.props.map((p) => p.type))],
            }
          : {}),
        ...(context.surface
          ? { caseId: context.surface.id, surfaceRecipe: "city-surfaces-v1" }
          : {}),
        prefabIds: context.prefabs.map((p) => p.type),
        revision,
        url: context.url,
        ...(candidate ? { renderFingerprint: candidate.review.renderFingerprint } : {}),
      },
      ...(verdict ? { buildingVerdict: { value: verdict, createdAt } } : {}),
    };
    inbox.enqueue(row);
    if (drafts[key]?.trim() === note) delete drafts[key];
    if (key === draftKey && noteInput.value.trim() === note) noteInput.value = "";
    persistDrafts();
    if (verdict && candidate) {
      batch = batch.filter((entry) => entry.key !== candidate.key);
      if (verdict === "changes")
        batch.push({
          key: candidate.key,
          fingerprint: required(candidate.review.renderFingerprint),
          threadId: id,
        });
      paused = batch.length >= 2;
      persistReview();
      if (!paused) navigate(1);
    } else $<HTMLDetailsElement>("building-feedback-history").open = true;
  } catch (error) {
    $("feedback-sync").textContent =
      `Could not queue feedback: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    // Absorb a double tap before the next candidate becomes actionable.
    if (verdict) await new Promise((resolve) => setTimeout(resolve, 160));
    sending = false;
    updateQueue();
  }
}
$("building-note-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void saveFeedback();
});
$("approve-building").onclick = () => void saveFeedback("approved");
$("reject-building").onclick = () => void saveFeedback("changes");
$("refresh-building-notes").onclick = () => void inbox.sync();
window.addEventListener("online", () => void inbox.sync());
setInterval(() => {
  if (inbox.outbox.length) void inbox.sync();
}, 15000);
renderFeedbackNotes();
const initialSync = inbox.sync();
let sheet: Spritesheet;
try {
  if (
    source.fingerprint !==
    (surfaceRun ? CITY_SURFACE_SOURCE.fingerprint : CITY_PREFAB_SOURCE.fingerprint)
  )
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
  if (surfaceRun) {
    renderSurface();
    return;
  }
  if (streetRun) select.value = currentStreet().buildingType;
  let prefab = required(CITY_BUILDING_PREFABS.find((p) => p.type === select.value));
  placements =
    scene.value === "single" || streetRun
      ? [{ prefab, wx: 0, wy: 0 }]
      : cityPrefabBlock(scene.value as "residential" | "mixed" | "hotel");
  if (!placements.some((p) => p.prefab.type === prefab.type)) {
    prefab = required(placements[0]).prefab;
    select.value = prefab.type;
  }
  const stats = streetRun
    ? drawStreetShowcase(canvas, currentStreet(), sheet, $<HTMLInputElement>("geometry").checked)
    : drawBuildingShowcase(canvas, placements, sheet, $<HTMLInputElement>("geometry").checked);
  fitPreview();
  $("loading").textContent = "";
  $("name").textContent = streetRun
    ? currentStreet().name
    : scene.value === "single"
      ? prefab.name
      : `${scene.selectedOptions[0]?.textContent} · ${placements.length} prefabs`;
  $("hotel-options").hidden = scene.value !== "single" || prefab.family !== "hotel";
  hotelSign.value = prefab.hotelSign ?? "none";
  $("facts").textContent =
    `${stats.width}×${stats.height} native stage pixels · ${stats.parts} shared sprite pieces${scene.value === "single" ? ` · footprint ${prefab.width}×${prefab.groundDepth}` : ""}`;
  $("recipe-id").textContent = streetRun ? currentStreet().id : prefab.type;
  $("assembly-summary").textContent = streetRun
    ? currentStreet().prompt
    : scene.value === "single"
      ? `Complete facade · both ends closed · ${prefab.profile === "flat-front" ? "flat frontage" : "bay frontage"} · ${prefab.topology.modules.length} connected section(s) · shared roof datum`
      : "Complete building assemblies with closed exterior ends and independently assembled roof decks.";
  $("bookmark-notice").textContent =
    requestedType !== resolvedType && select.value === resolvedType
      ? "The old storefront-only link now shows a complete building with apartments."
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
  if (prefab.family === "storefront") {
    const front = document.createElement("p");
    front.textContent =
      "Shop, upper walls, and roof share the same flat frontage and native width. The sign overhangs the ground-floor wall.";
    topology.append(front);
  }
  if (prefab.family === "hotel") {
    const signage = document.createElement("p");
    signage.textContent = `Full hotel top plus separate trim. Sign: ${prefab.hotelSign}. Signage changes art bounds; the 272px wall footprint and entrance stay fixed.`;
    topology.append(signage);
  }
  const sourceUrl = new URL("art-workbench.html", location.href);
  sourceUrl.searchParams.set("sheet", CITY_PREFAB_SOURCE.sheetId);
  const rects = reviewSourceRects([prefab], streetRun ? currentStreet() : undefined);
  const x = Math.min(...rects.map((p) => p[0])),
    y = Math.min(...rects.map((p) => p[1]));
  const ex = Math.max(...rects.map((p) => p[0] + p[2])),
    ey = Math.max(...rects.map((p) => p[1] + p[3]));
  sourceUrl.searchParams.set("rect", [x, y, ex - x, ey - y].join(","));
  $<HTMLAnchorElement>("source-link").href = sourceUrl.href;
  const picks = $("block-buildings");
  picks.replaceChildren();
  for (const p of scene.value === "single" || streetRun ? [] : placements) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = p.prefab.name;
    button.onclick = () => {
      select.value = p.prefab.type;
      scene.value = "single";
      showSelection();
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
  if (streetRun) {
    for (const p of currentStreet().props) {
      const sprite = createProp(p.type, p.wx, p.wy).sprite;
      const link = document.createElement("a");
      const u = new URL("art-workbench.html", location.href);
      u.searchParams.set("sheet", CITY_PREFAB_SOURCE.sheetId);
      u.searchParams.set(
        "rect",
        [sprite.frameCol * 16, sprite.frameRow * 16, sprite.spriteWidth, sprite.spriteHeight].join(
          ",",
        ),
      );
      link.href = u.href;
      link.textContent = `${PROP_PALETTE.find((entry) => entry.type === p.type)?.label ?? p.type} · inspect source`;
      const row = document.createElement("p");
      row.append(link);
      pieces.append(row);
    }
    $("facts").textContent =
      `${stats.width}×${stats.height} native stage pixels · ${currentStreet().props.length} street props · 40px clear walking strip`;
    $("topology").textContent =
      "Green: clear walking strip. Gold: door approach. Red: actual game collision. Surface bands and parking paint are diagnostic; this is the starter palette, not yet a generated city.";
    $("source-link").textContent = "Inspect this scene’s source art ↗";
    required($("topology").parentElement?.querySelector("summary")).textContent =
      "Placement & clearances";
    required($("pieces").parentElement?.querySelector("summary")).textContent =
      "Props & source links";
    $<HTMLTextAreaElement>("building-note").placeholder = currentStreet().prompt;
  }
  const url = new URL(location.href);
  if (streetRun) {
    url.searchParams.delete("scene");
    url.searchParams.delete("prefab");
    url.searchParams.set("case", currentStreet().id);
  } else {
    url.searchParams.set("scene", scene.value);
    url.searchParams.set("prefab", prefab.type);
  }
  history.replaceState(null, "", url);
  $("app").dataset.ready = "true";
  canvas.dataset.parts = String(stats.parts);
  canvas.dataset.prefabs = String(placements.length);
  const previousTarget = feedbackScene === scene.value ? target.value : "";
  target.replaceChildren(
    ...(streetRun
      ? [new Option("This street scene", "block")]
      : [
          ...(scene.value === "single" ? [] : [new Option("Whole block", "block")]),
          ...placements.map((p) => new Option(p.prefab.name, p.prefab.type)),
        ]),
  );
  if ([...target.options].some((option) => option.value === previousTarget))
    target.value = previousTarget;
  feedbackScene = scene.value;
  updateFeedbackTarget();
  updateQueue();
  persistReview();
}
function renderSurface() {
  placements = [];
  const c = currentSurface(),
    pieces = composeCitySurface(c);
  const stats = drawSurfaceShowcase(canvas, c, sheet, $<HTMLInputElement>("geometry").checked);
  fitPreview();
  $("loading").textContent = "";
  $("name").textContent = c.name;
  $("hotel-options").hidden = true;
  $("facts").textContent =
    `${stats.width}×${stats.height} native pixels · ${c.roadWidth * 16}px roadway · ${c.palette} pavement`;
  $("recipe-id").textContent = c.id;
  $("assembly-summary").textContent = c.prompt;
  $("bookmark-notice").textContent = "";
  $("block-buildings").replaceChildren();
  $("topology").textContent =
    "Original asphalt, pavement, curb shading and paint tiles. Square curb corners; rounded raised median. Crossings currently stop before the curb: ramps and accessibility come after this surface review. This shared surface recipe is a candidate for the next district revision; existing worlds keep their surfaces.";
  required($("topology").parentElement?.querySelector("summary")).textContent =
    "Surface construction";
  required($("pieces").parentElement?.querySelector("summary")).textContent =
    "Tiles & source links";
  $("pieces").replaceChildren();
  const unique = new Map(pieces.map((p) => [p.rect.join(","), p]));
  for (const p of unique.values()) {
    const row = document.createElement("p"),
      link = document.createElement("a");
    const u = new URL("art-workbench.html", location.href);
    u.searchParams.set("sheet", CITY_SURFACE_SOURCE.sheetId);
    u.searchParams.set("rect", p.rect.join(","));
    link.href = u.href;
    link.textContent = `${p.label} · [${p.rect.join(", ")}]`;
    row.append(link);
    $("pieces").append(row);
  }
  const selection =
    c.palette === "original"
      ? [512, 16, 288, 288]
      : c.palette === "warm"
        ? [416, 1904, 384, 352]
        : [0, 1904, 384, 352];
  const sourceUrl = new URL("art-workbench.html", location.href);
  sourceUrl.searchParams.set("sheet", CITY_SURFACE_SOURCE.sheetId);
  sourceUrl.searchParams.set("rect", selection.join(","));
  $<HTMLAnchorElement>("source-link").href = sourceUrl.href;
  $("source-link").textContent = "Inspect the selected road bank ↗";
  noteInput.placeholder = c.prompt;
  const url = new URL(location.href);
  url.searchParams.set("case", c.id);
  history.replaceState(null, "", url);
  $("app").dataset.ready = "true";
  canvas.dataset.parts = String(stats.parts);
  canvas.dataset.prefabs = "0";
  target.replaceChildren(new Option("This road scene", "block"));
  feedbackScene = "surface";
  updateFeedbackTarget();
  updateQueue();
  persistReview();
}
surfaceSelect.addEventListener("change", showSelection);
streetSelect.addEventListener("change", showSelection);
for (const control of [$("geometry"), $("scale")]) control.addEventListener("change", render);
scene.addEventListener("change", showSelection);
select.addEventListener("change", () => {
  scene.value = "single";
  showSelection();
});
hotelSign.addEventListener("change", () => {
  const prefab = required(CITY_BUILDING_PREFABS.find((p) => p.type === select.value));
  if (scene.value !== "single" || prefab.family !== "hotel") return;
  select.value = hotelPrefabType(prefab.floors, hotelSign.value as HotelSign);
  showSelection();
});

interface Candidate {
  key: string;
  name: string;
  scene: BuildingReview["scene"];
  prefab: string;
  review: BuildingReview;
}
interface BatchEntry {
  key: string;
  fingerprint: string;
  threadId: string;
}
const candidates: Candidate[] = [];
const filter = $<HTMLSelectElement>("review-filter");
let batch: BatchEntry[] = [];
let paused = false;
let storedSelection = "";
try {
  const stored = JSON.parse(localStorage.getItem(reviewStorage) ?? "{}");
  if (["unchecked", "all", "approved", "changes"].includes(stored.filter))
    filter.value = stored.filter;
  if (Array.isArray(stored.batch))
    batch = stored.batch
      .filter(
        (e: BatchEntry) =>
          e &&
          typeof e.key === "string" &&
          typeof e.fingerprint === "string" &&
          typeof e.threadId === "string",
      )
      .slice(-2);
  paused = !!stored.paused;
  if (typeof stored.selected === "string") storedSelection = stored.selected;
} catch {
  /* Ignore corrupt review state. */
}
function persistReview() {
  try {
    localStorage.setItem(
      reviewStorage,
      JSON.stringify({ filter: filter.value, batch, paused, selected: selectedKey() }),
    );
  } catch {
    $("feedback-sync").textContent = "Review navigation could not be saved in this browser.";
  }
}
function selectedKey() {
  return surfaceRun
    ? `surface:${surfaceSelect.value}`
    : streetRun
      ? `street:${streetSelect.value}`
      : scene.value === "single"
        ? `single:${select.value}`
        : `block:${scene.value}`;
}
function verdictFor(candidate: Candidate) {
  return currentBuildingVerdict(inbox.notes, source.fingerprint, candidate.review);
}
function queue() {
  return candidates.filter((candidate) => {
    const verdict = verdictFor(candidate);
    return (
      filter.value === "all" || (filter.value === "unchecked" ? !verdict : verdict === filter.value)
    );
  });
}
function fitPreview() {
  const stage = required(canvas.parentElement);
  const scale = $<HTMLSelectElement>("scale").value;
  const width =
    scale === "fit"
      ? Math.min(
          stage.clientWidth - 2,
          ((stage.clientHeight - 2) * canvas.width) / canvas.height,
          canvas.width,
        )
      : canvas.width / (scale === "native" ? 2 : 1);
  canvas.style.width = `${Math.max(1, width)}px`;
}
new ResizeObserver(fitPreview).observe(required(canvas.parentElement));
function updateQueue() {
  const visible = queue();
  const approved = candidates.filter((c) => verdictFor(c) === "approved").length;
  const changes = candidates.filter((c) => verdictFor(c) === "changes").length;
  const index = visible.findIndex((c) => c.key === selectedKey());
  if (queueReady && !sending && !paused && index < 0 && visible[0]) {
    openCandidate(visible[0]);
    return;
  }
  $("review-progress").textContent =
    `${index < 0 ? 0 : index + 1}/${visible.length} · ${approved} approved · ${changes} need changes`;
  const empty = verified && !visible.length;
  $("review-empty").hidden = !empty || paused;
  $("empty-summary").textContent =
    `${approved} approved and ${changes} need changes. Changed candidates will return to Unchecked.`;
  $("review-pause").hidden = !paused;
  required(document.querySelector<HTMLElement>(".building-review-layout")).hidden = empty || paused;
  const candidate = candidates.find((c) => c.key === selectedKey());
  const verdict = candidate && verdictFor(candidate);
  $("review-verdict").textContent =
    verdict === "approved"
      ? "Approved · this appearance"
      : verdict === "changes"
        ? "Needs changes · report saved"
        : "Unchecked · this appearance";
  for (const id of ["previous-building", "next-building"])
    $<HTMLButtonElement>(id).disabled = !verified || sending || paused || visible.length < 2;
  for (const id of ["approve-building", "reject-building", "save-building-note"])
    $<HTMLButtonElement>(id).disabled = !verified || sending || paused || empty;
  $<HTMLButtonElement>("undo-building").disabled = sending || !latestDecision();
  const list = $("review-batch");
  list.replaceChildren(
    ...batch.map((entry) => {
      const item = document.createElement("li");
      const row = inbox.notes.find((r) => r.threadId === entry.threadId);
      item.textContent = `${candidates.find((c) => c.key === entry.key)?.name ?? entry.key}: ${row?.note ?? "Report saved"}`;
      return item;
    }),
  );
  // Keep server status visible even when the review stage is paused or exhausted.
  $("queue-sync").textContent = inbox.status;
}
function openCandidate(candidate: Candidate) {
  scene.value = candidate.scene;
  select.value = candidate.prefab;
  if (candidate.review.caseId)
    (surfaceRun ? surfaceSelect : streetSelect).value = candidate.review.caseId;
  render();
}
function navigate(direction: number) {
  const visible = queue();
  if (!visible.length) {
    updateQueue();
    return;
  }
  const current = candidates.findIndex((c) => c.key === selectedKey());
  for (let step = 1; step <= candidates.length; step++) {
    const candidate =
      candidates[(current + direction * step + candidates.length) % candidates.length];
    if (candidate && visible.includes(candidate)) {
      openCandidate(candidate);
      return;
    }
  }
}
function showSelection() {
  // An explicit jump is allowed to inspect a reviewed item.
  const candidate = candidates.find((c) => c.key === selectedKey());
  if (candidate && !queue().includes(candidate)) {
    filter.value = "all";
    persistReview();
  }
  render();
}
function latestDecision() {
  const sorted = inbox.notes
    .filter(
      (r) =>
        r.buildingVerdict &&
        r.buildingReview &&
        candidates.some((c) => c.key === buildingCaseKey(required(r.buildingReview))),
    )
    .sort(
      (a, b) =>
        Date.parse(required(b.buildingVerdict).createdAt) -
        Date.parse(required(a.buildingVerdict).createdAt),
    );
  const seen = new Set<string>();
  for (const row of sorted) {
    const key = buildingCaseKey(required(row.buildingReview));
    if (seen.has(key)) continue;
    seen.add(key);
    if (row.buildingVerdict?.value !== "clear") return row;
  }
  return undefined;
}
$("previous-building").onclick = () => navigate(-1);
$("next-building").onclick = () => navigate(1);
filter.onchange = () => {
  persistReview();
  if (!queue().some((c) => c.key === selectedKey())) {
    const first = queue()[0];
    if (first) openCandidate(first);
  }
  updateQueue();
};
$("show-all-buildings").onclick = () => {
  filter.value = "all";
  filter.onchange?.(new Event("change"));
  fitPreview();
};
$("continue-review").onclick = () => {
  paused = false;
  batch = [];
  persistReview();
  navigate(1);
  updateQueue();
  fitPreview();
};
$("check-building-updates").onclick = () => location.reload();
$("undo-building").onclick = () => {
  if (sending) return;
  const previous = latestDecision();
  if (!previous?.buildingReview || previous.buildingVerdict?.value === "clear") return;
  sending = true;
  const id = crypto.randomUUID(),
    createdAt = new Date().toISOString();
  inbox.enqueue({
    ...previous,
    id,
    threadId: id,
    status: "resolved",
    reply: "",
    note: "Reopened for review.",
    createdAt,
    buildingVerdict: { value: "clear", createdAt },
  });
  batch = batch.filter((e) => e.key !== buildingCaseKey(required(previous.buildingReview)));
  paused = false;
  filter.value = "unchecked";
  persistReview();
  const candidate = candidates.find(
    (c) => c.key === buildingCaseKey(required(previous.buildingReview)),
  );
  if (candidate) openCandidate(candidate);
  updateQueue();
  fitPreview();
  setTimeout(() => {
    sending = false;
    updateQueue();
  }, 160);
};
document.addEventListener("keydown", (event) => {
  if (
    (event.target instanceof HTMLElement &&
      (event.target.closest("input,textarea,select,button,a") || event.target.isContentEditable)) ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.repeat ||
    sending ||
    paused
  )
    return;
  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    event.preventDefault();
    navigate(event.key === "ArrowRight" ? 1 : -1);
  } else if (event.code === "Space") {
    event.preventDefault();
    void saveFeedback("approved");
  } else if (event.key.toLowerCase() === "x") {
    event.preventDefault();
    void saveFeedback("changes");
  }
});
const hashCanvas = document.createElement("canvas");
if (!streetRun && !surfaceRun)
  for (const entry of [
    ...CITY_BUILDING_PREFABS.map((p) => ({ scene: "single" as const, prefab: p, name: p.name })),
    ...(["residential", "mixed", "hotel"] as const).map((s) => ({
      scene: s,
      prefab: required(cityPrefabBlock(s)[0]).prefab,
      name: `${s} block`,
    })),
  ]) {
    const items =
      entry.scene === "single"
        ? [{ prefab: entry.prefab, wx: 0, wy: 0 }]
        : cityPrefabBlock(entry.scene);
    drawBuildingShowcase(hashCanvas, items, sheet, false);
    const pixels = required(hashCanvas.getContext("2d")).getImageData(
      0,
      0,
      hashCanvas.width,
      hashCanvas.height,
    ).data;
    const pixelHash = await sha256(pixels);
    const review: BuildingReview = {
      scene: entry.scene,
      prefabIds: items.map((p) => p.prefab.type),
      revision: await sha256(new TextEncoder().encode(JSON.stringify(items.map((p) => p.prefab)))),
      renderFingerprint: await sha256(
        new TextEncoder().encode(`${hashCanvas.width}:${hashCanvas.height}:${pixelHash}`),
      ),
      url: `/tilefun/building-lab.html?scene=${entry.scene}&prefab=${entry.prefab.type}`,
    };
    candidates.push({
      key: buildingCaseKey(review),
      name: entry.name,
      scene: entry.scene,
      prefab: entry.prefab.type,
      review,
    });
  }
if (streetRun)
  for (const entry of STREET_REVIEW_SCENES) {
    drawStreetShowcase(hashCanvas, entry, sheet, false);
    const pixels = required(hashCanvas.getContext("2d")).getImageData(
      0,
      0,
      hashCanvas.width,
      hashCanvas.height,
    ).data;
    const pixelHash = await sha256(pixels);
    const review: BuildingReview = {
      scene: "street",
      caseId: entry.id,
      prefabIds: [entry.buildingType],
      propTypes: [...new Set(entry.props.map((p) => p.type))],
      revision: await sha256(new TextEncoder().encode(JSON.stringify(streetComposition(entry)))),
      renderFingerprint: await sha256(
        new TextEncoder().encode(`${hashCanvas.width}:${hashCanvas.height}:${pixelHash}`),
      ),
      url: `/tilefun/building-lab.html?run=streets&case=${entry.id}`,
    };
    candidates.push({
      key: buildingCaseKey(review),
      name: entry.name,
      scene: "street",
      prefab: entry.buildingType,
      review,
    });
  }
if (surfaceRun)
  for (const entry of CITY_SURFACE_CASES) {
    drawSurfaceShowcase(hashCanvas, entry, sheet, false);
    const pixels = required(hashCanvas.getContext("2d")).getImageData(
      0,
      0,
      hashCanvas.width,
      hashCanvas.height,
    ).data;
    const pixelHash = await sha256(pixels);
    const review: BuildingReview = {
      scene: "surface",
      caseId: entry.id,
      prefabIds: [],
      surfaceRecipe: "city-surfaces-v1",
      revision: await sha256(
        new TextEncoder().encode(JSON.stringify(citySurfaceComposition(entry))),
      ),
      renderFingerprint: await sha256(
        new TextEncoder().encode(`${hashCanvas.width}:${hashCanvas.height}:${pixelHash}`),
      ),
      url: `/tilefun/building-lab.html?run=surfaces&case=${entry.id}`,
    };
    candidates.push({
      key: buildingCaseKey(review),
      name: entry.name,
      scene: "surface",
      prefab: "",
      review,
    });
  }
await initialSync;
queueReady = true;
renderFeedbackNotes();
batch = batch.filter((entry) => {
  const candidate = candidates.find((c) => c.key === entry.key);
  return (
    candidate?.review.renderFingerprint === entry.fingerprint && verdictFor(candidate) === "changes"
  );
});
if (batch.length < 2) paused = false;
if (!paused && !queue().some((c) => c.key === selectedKey())) {
  if (
    (params.has("scene") || params.has("prefab") || params.has("case")) &&
    storedSelection !== selectedKey()
  )
    filter.value = "all";
  else {
    const first = queue()[0];
    if (first) {
      scene.value = first.scene;
      select.value = first.prefab;
      if (first.review.caseId)
        (surfaceRun ? surfaceSelect : streetSelect).value = first.review.caseId;
    }
  }
}
persistReview();
render();
