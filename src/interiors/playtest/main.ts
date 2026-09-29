import {
  getModernInteriorsEntry,
  loadModernInteriorsAtlasIndex,
} from "../../assets/ModernInteriorsAtlasIndex.js";
import { Spritesheet } from "../../assets/Spritesheet.js";
import { PIXEL_SCALE, PLAYER_SPEED, PLAYER_SPRITE_SIZE } from "../../config/constants.js";
import { Camera } from "../../rendering/Camera.js";
import { drawScene2D } from "../../rendering/Canvas2DRenderer.js";
import type { SpriteItem } from "../../rendering/SceneItem.js";
import {
  drawFurnishedInterior,
  furnitureDrawOrder,
  furnitureSignature,
} from "../FurnishedInterior.js";
import { FURNITURE_CATALOG_VERSION, type FurniturePlacement } from "../FurnitureCatalog.js";
import { FurnitureMotion, MOTION_SCENES, MOTION_SKETCH } from "../FurnitureMotion.js";
import spriteIndexUrl from "../review/assets/review-sprites.json?url";
import spriteUrl from "../review/assets/review-sprites.png?url";
import { parseReviewFeedback, type ReviewFeedback } from "../review/ReviewFeedback.js";
import "./playtest.css";

const root = document.getElementById("app");
if (!root) throw new Error("Missing app");
root.innerHTML = `<header><a href="./interior-review.html?stage=15">← Review</a><span id="sync" role="status">Loading…</span></header>
<h1>Furniture in motion</h1><p>Walk behind and in front. Check what actually blocks your feet.</p>
<div class="toolbar"><label>Scene <select id="scene">${MOTION_SCENES.map((s) => `<option value="${s.id}">${s.name}</option>`).join("")}</select></label><button id="reset">Reset scene</button></div>
<div id="viewport"><canvas id="room" tabindex="0" aria-label="Furniture movement test"></canvas></div>
<div class="toolbar"><label><input id="collisions" type="checkbox" checked> Collision</label><label><input id="bounds" type="checkbox"> Sprite bounds</label><label><input id="depth" type="checkbox"> Depth lines</label></div>
<p class="legend">Pink: solid footprint · Cyan: player’s feet · White: image extent</p>
<div class="toolbar"><label>Mode <select id="mode"><option value="walk">Walk</option><option value="place">Place furniture</option></select></label><button id="circle">Walk around object</button><button id="home">Reset player</button></div>
<div id="walk-controls"><p>Arrow keys / WASD, or hold a direction below.</p><div class="pad"><button data-dx="-1" data-dy="0" aria-label="Walk left">←</button><button data-dx="0" data-dy="-1" aria-label="Walk up">↑</button><button data-dx="0" data-dy="1" aria-label="Walk down">↓</button><button data-dx="1" data-dy="0" aria-label="Walk right">→</button></div></div>
<div class="toolbar"><label>Object <select id="object"></select></label><span id="dimensions"></span></div>
<div id="placement" hidden><p>Drag the object, or adjust its ground anchor by single pixels. Items on top move with it.</p><div class="toolbar"><label>X <input id="x" type="number" step="1"></label><label>Y <input id="y" type="number" step="1"></label><button id="apply">Apply position</button></div><div class="pad"><button data-nx="-1" data-ny="0" aria-label="Move object left one pixel">← 1px</button><button data-nx="0" data-ny="-1" aria-label="Move object up one pixel">↑ 1px</button><button data-nx="0" data-ny="1" aria-label="Move object down one pixel">↓ 1px</button><button data-nx="1" data-ny="0" aria-label="Move object right one pixel">→ 1px</button></div></div>
<p id="position"></p><p id="status" role="status">Preparing scene…</p>
<section class="report"><label>Optional note <input id="note" maxlength="1800" placeholder="e.g. I stop too far from the wardrobe"></label><button id="report">Report issue</button><p>Your scene, player position and screenshot are included.</p></section>`;
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = el<HTMLCanvasElement>("room"),
  ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Missing canvas");
const scene = el<HTMLSelectElement>("scene"),
  object = el<HTMLSelectElement>("object"),
  mode = el<HTMLSelectElement>("mode");
const storage = "tilefun.furniture-motion.v1",
  outboxKey = "tilefun.furniture-motion-outbox.v1";
let saved: Record<string, FurniturePlacement[]> = {};
let outbox: ReviewFeedback[] = [];
try {
  saved = JSON.parse(localStorage.getItem(storage) ?? "{}");
  if (!saved || Array.isArray(saved) || typeof saved !== "object") saved = {};
} catch {
  saved = {};
}
try {
  outbox = JSON.parse(localStorage.getItem(outboxKey) ?? "[]").map(parseReviewFeedback);
} catch {
  outbox = [];
}
const requested = new URL(location.href).searchParams.get("scene");
if (MOTION_SCENES.some((s) => s.id === requested)) scene.value = requested ?? "bunk";
const defaultScene = () => {
  const value = MOTION_SCENES[0];
  if (!value) throw new Error("Missing default scene");
  return value;
};
let model = new FurnitureMotion(defaultScene().furniture);
let dirty = true,
  ready = false,
  syncing = false,
  placementError = "";
let path: [number, number][] = [];
let targets: [number, number][] = [];
let circling = false,
  stuck = 0;
const keys = new Set<string>();
let held: [number, number] = [0, 0];
const atlas = new Image(),
  playerImage = new Image();
const camera = new Camera();
camera.zoom = 1 / PIXEL_SCALE;
const sheets = new Map<string, Spritesheet>();
let alpha: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function status(message: string) {
  el("status").textContent = message;
}
function stop() {
  circling = false;
  path = [];
  targets = [];
  stuck = 0;
  el("circle").textContent = "Walk around object";
}
function selection() {
  const o = model.objects.find((o) => o.placement.id === object.value);
  if (!o) throw new Error("Missing selected object");
  return o;
}
function fields() {
  const o = selection();
  el<HTMLInputElement>("x").value = String(o.x);
  el<HTMLInputElement>("y").value = String(o.y);
  el("dimensions").textContent =
    `Solid ${o.footprint.width}×${o.footprint.height}px · Sprite ${o.definition.size.join("×")}px`;
  dirty = true;
}
function persist() {
  saved[scene.value] = model.furniture;
  try {
    localStorage.setItem(storage, JSON.stringify(saved));
  } catch {
    status("Placement works, but browser storage is full; reload will lose it.");
  }
}
function load(reset = false) {
  stop();
  placementError = "";
  keys.clear();
  held = [0, 0];
  const preset = MOTION_SCENES.find((s) => s.id === scene.value) ?? defaultScene();
  try {
    model = new FurnitureMotion(
      !reset && saved[preset.id] ? (saved[preset.id] ?? preset.furniture) : preset.furniture,
    );
  } catch {
    model = new FurnitureMotion(preset.furniture);
  }
  if (reset) persist();
  object.replaceChildren(
    ...model.objects
      .filter((o) => !o.parent)
      .map((o) => {
        const option = document.createElement("option");
        option.value = o.placement.id;
        option.textContent = o.definition.name;
        return option;
      }),
  );
  canvas.width = model.map.width * 16;
  canvas.height = model.map.pixelHeight;
  camera.setViewport(canvas.width, canvas.height);
  camera.snapTo(canvas.width / 2, canvas.height / 2);
  fields();
  resize();
  status("Ready. Walk around the object or turn on placement mode.");
  history.replaceState(null, "", `?scene=${preset.id}`);
}
function resize() {
  const available = el("viewport").clientWidth - 16;
  const scale = Math.max(1, Math.min(3, Math.floor(available / canvas.width)));
  canvas.style.width = `${canvas.width * scale}px`;
  canvas.style.height = `${canvas.height * scale}px`;
}
function moveObject(x: number, y: number) {
  stop();
  try {
    model.moveObject(object.value, x, y);
    persist();
    fields();
    placementError = "";
    status("Placement updated.");
  } catch (error) {
    placementError = error instanceof Error ? error.message : String(error);
    status(placementError);
  }
  dirty = true;
}
scene.addEventListener("change", () => load());
el("reset").onclick = () => load(true);
object.onchange = () => {
  stop();
  fields();
};
mode.onchange = () => {
  stop();
  keys.clear();
  held = [0, 0];
  el("placement").hidden = mode.value !== "place";
  el("walk-controls").hidden = mode.value !== "walk";
  canvas.style.cursor = mode.value === "place" ? "grab" : "default";
  dirty = true;
};
el("apply").onclick = () =>
  moveObject(el<HTMLInputElement>("x").valueAsNumber, el<HTMLInputElement>("y").valueAsNumber);
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-nx]"))
  button.onclick = () => {
    const o = selection();
    moveObject(o.x + Number(button.dataset.nx), o.y + Number(button.dataset.ny));
  };
for (const id of ["collisions", "bounds", "depth"])
  el(id).onchange = () => {
    dirty = true;
  };
el("home").onclick = () => {
  stop();
  if (model.canStand(80, 120)) {
    model.player.position = { wx: 80, wy: 120 };
    model.player.velocity = { vx: 0, vy: 0 };
    dirty = true;
  } else status("Move furniture away from the starting position first.");
};
el("circle").onclick = () => {
  if (circling) {
    stop();
    status("Walk stopped.");
    return;
  }
  targets = model.circleTargets(object.value);
  path = [];
  circling = true;
  stuck = 0;
  el("circle").textContent = "Stop walking";
  status("Walking around the selected footprint. Watch the character pass behind and in front.");
};
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-dx]")) {
  button.onpointerdown = (e) => {
    e.preventDefault();
    stop();
    held = [Number(button.dataset.dx), Number(button.dataset.dy)];
    button.setPointerCapture(e.pointerId);
  };
  const release = () => {
    held = [0, 0];
  };
  button.onpointerup = release;
  button.onpointercancel = release;
  button.onlostpointercapture = release;
}
const movementKeys = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
]);
addEventListener("keydown", (e) => {
  if (
    !movementKeys.has(e.code) ||
    /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName) ||
    mode.value !== "walk"
  )
    return;
  e.preventDefault();
  stop();
  keys.add(e.code);
});
addEventListener("keyup", (e) => keys.delete(e.code));
function clearInput() {
  keys.clear();
  held = [0, 0];
  stop();
}
addEventListener("blur", clearInput);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearInput();
});
const point = (e: PointerEvent): [number, number] => {
  const b = canvas.getBoundingClientRect();
  return [
    ((e.clientX - b.left) * canvas.width) / b.width,
    ((e.clientY - b.top) * canvas.height) / b.height,
  ];
};
let drag: { pointer: number; x: number; y: number; px: number; py: number } | null = null;
canvas.onpointerdown = (e) => {
  if (mode.value !== "place" || !ready) return;
  const [x, y] = point(e);
  const hit = [...furnitureDrawOrder(model.objects)].reverse().find((o) => {
    const sx = Math.floor(x - o.origin[0]),
      sy = Math.floor(y - o.origin[1]),
      entry = getModernInteriorsEntry(o.definition.key);
    return (
      entry &&
      sx >= 0 &&
      sy >= 0 &&
      sx < o.definition.size[0] &&
      sy < o.definition.size[1] &&
      (alpha.getImageData(entry.rect[0] + sx, entry.rect[1] + sy, 1, 1).data[3] ?? 0) > 16
    );
  });
  if (!hit) return;
  const selected = hit.parent ?? hit;
  object.value = selected.placement.id;
  fields();
  drag = { pointer: e.pointerId, x, y, px: selected.x, py: selected.y };
  canvas.setPointerCapture(e.pointerId);
  e.preventDefault();
};
canvas.onpointermove = (e) => {
  if (drag?.pointer !== e.pointerId) return;
  const [x, y] = point(e);
  moveObject(drag.px + x - drag.x, drag.py + y - drag.y);
};
const endDrag = () => {
  drag = null;
};
canvas.onpointerup = endDrag;
canvas.onpointercancel = endDrag;
canvas.onlostpointercapture = endDrag;
addEventListener("resize", resize);

function draw() {
  if (!ctx || !ready) return;
  ctx.fillStyle = "#171e2a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const p = model.player,
    s = p.sprite;
  if (!s) return;
  const item: SpriteItem = {
    kind: "sprite",
    sortKey: p.position.wy,
    wx: p.position.wx,
    wy: p.position.wy,
    zOffset: 0,
    sheetKey: "player",
    frameCol: s.frameCol,
    frameRow: s.frameRow,
    spriteWidth: s.spriteWidth,
    spriteHeight: s.spriteHeight,
    flipX: false,
    drawOffsetY: 0,
    hasShadow: false,
    shadowFeetWy: p.position.wy,
    shadowWidth: 10,
    shadowTerrainZ: 0,
    flashHidden: false,
  };
  drawFurnishedInterior(
    ctx,
    atlas,
    model.map,
    model.plan,
    model.furniture,
    [
      {
        id: "player",
        depth: p.position.wy,
        draw: (c) => drawScene2D(c, camera, [item], sheets, undefined),
      },
    ],
    model.placementArea,
  );
  if (el<HTMLInputElement>("collisions").checked) {
    ctx.strokeStyle = "#ff719a";
    for (const { bounds: b } of model.collisionBoxes())
      ctx.strokeRect(b.left + 0.5, b.top + 0.5, b.right - b.left - 1, b.bottom - b.top - 1);
    const r = model.playerBounds();
    ctx.strokeStyle = "#62efff";
    ctx.strokeRect(r.left + 0.5, r.top + 0.5, r.right - r.left - 1, r.bottom - r.top - 1);
    ctx.strokeStyle = "#536c85";
    ctx.strokeRect(
      model.floor.left + 0.5,
      model.floor.top + 0.5,
      model.floor.right - model.floor.left - 1,
      model.floor.bottom - model.floor.top - 1,
    );
  }
  if (el<HTMLInputElement>("bounds").checked) {
    ctx.strokeStyle = "#ffffff";
    ctx.setLineDash([2, 2]);
    for (const o of model.objects)
      ctx.strokeRect(
        o.origin[0] + 0.5,
        o.origin[1] + 0.5,
        o.definition.size[0] - 1,
        o.definition.size[1] - 1,
      );
    ctx.strokeRect(
      Math.floor(p.position.wx - 8) + 0.5,
      Math.floor(p.position.wy - 16) + 0.5,
      15,
      15,
    );
    ctx.setLineDash([]);
  }
  if (el<HTMLInputElement>("depth").checked) {
    ctx.strokeStyle = "#ffe47b";
    for (const o of model.objects.filter((o) => !o.parent && o.definition.layer === "standing")) {
      ctx.beginPath();
      ctx.moveTo(o.footprint.x, o.depth + 0.5);
      ctx.lineTo(o.footprint.x + o.footprint.width, o.depth + 0.5);
      ctx.stroke();
    }
    ctx.fillStyle = "#62efff";
    ctx.fillRect(Math.floor(p.position.wx) - 7, Math.floor(p.position.wy), 14, 1);
  }
  if (mode.value === "place") {
    const o = selection();
    ctx.strokeStyle = "#ffe47b";
    ctx.strokeRect(
      o.origin[0] - 0.5,
      o.origin[1] - 0.5,
      o.definition.size[0] + 1,
      o.definition.size[1] + 1,
    );
    ctx.fillStyle = "#ffe47b";
    ctx.fillRect(o.x - 2, o.y, 5, 1);
    ctx.fillRect(o.x, o.y - 2, 1, 5);
  }
  canvas.dataset.playerX = p.position.wx.toFixed(3);
  canvas.dataset.playerY = p.position.wy.toFixed(3);
  canvas.dataset.circling = String(circling);
  el("position").textContent =
    `Player feet: ${p.position.wx.toFixed(1)}, ${p.position.wy.toFixed(1)} · Collision box: 10×6px`;
  dirty = false;
}
function autoVector(): [number, number] {
  if (!path.length) {
    const target = targets.shift();
    if (!target) {
      stop();
      status("Walk complete. Try a different object or adjust its position.");
      dirty = true;
      return [0, 0];
    }
    const route = model.pathTo(...target);
    if (!route) {
      stop();
      status("No clear route around this placement. Move the object or walk manually.");
      dirty = true;
      return [0, 0];
    }
    path = route;
  }
  const next = path[0];
  if (!next) return [0, 0];
  const dx = next[0] - model.player.position.wx,
    dy = next[1] - model.player.position.wy,
    dist = Math.hypot(dx, dy);
  if (dist < PLAYER_SPEED / 120 + 0.05) {
    path.shift();
    return [0, 0];
  }
  const scale = Math.max(dist, PLAYER_SPEED / 120);
  return [dx / scale, dy / scale];
}
let previous = performance.now(),
  accumulator = 0;
function frame(now: number) {
  accumulator += Math.min((now - previous) / 1000, 0.05);
  previous = now;
  while (ready && accumulator >= 1 / 120) {
    let dx =
      held[0] +
      Number(keys.has("ArrowRight") || keys.has("KeyD")) -
      Number(keys.has("ArrowLeft") || keys.has("KeyA"));
    let dy =
      held[1] +
      Number(keys.has("ArrowDown") || keys.has("KeyS")) -
      Number(keys.has("ArrowUp") || keys.has("KeyW"));
    if (circling) [dx, dy] = autoVector();
    else if (mode.value === "place") {
      dx = 0;
      dy = 0;
    }
    const { wx, wy } = model.player.position,
      oldFrame = model.player.sprite?.frameCol,
      oldFacing = model.player.sprite?.frameRow;
    model.step(dx, dy);
    const moved = Math.hypot(model.player.position.wx - wx, model.player.position.wy - wy);
    if (circling && (dx || dy)) {
      stuck = moved < 0.001 ? stuck + 1 : 0;
      if (stuck > 120) {
        stop();
        status("Movement stopped at a collision. You can report this position.");
      }
    }
    if (
      moved ||
      oldFrame !== model.player.sprite?.frameCol ||
      oldFacing !== model.player.sprite?.frameRow
    )
      dirty = true;
    accumulator -= 1 / 120;
  }
  if (!ready) accumulator = 0;
  if (dirty) draw();
  requestAnimationFrame(frame);
}
function storeOutbox() {
  try {
    localStorage.setItem(outboxKey, JSON.stringify(outbox));
    return true;
  } catch {
    return false;
  }
}
async function sync() {
  if (syncing) return;
  syncing = true;
  try {
    while (outbox.length) {
      const row = outbox[0];
      const response = await fetch("/tilefun/api/interior-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      if (!response.ok) throw new Error("Save failed");
      outbox.shift();
      storeOutbox();
    }
    el("sync").textContent = "Reports saved";
  } catch {
    el("sync").textContent = `Offline · ${outbox.length} report(s) pending`;
  } finally {
    syncing = false;
  }
}
el("report").onclick = async () => {
  if (!ready) return;
  const button = el<HTMLButtonElement>("report");
  button.disabled = true;
  stop();
  draw();
  try {
    const playtest = {
      playerX: model.player.position.wx,
      playerY: model.player.position.wy,
      facing: model.player.sprite?.frameRow ?? 0,
      selected: object.value,
      mode: mode.value as "walk" | "place",
    };
    const furniture = structuredClone(model.furniture),
      screenshot = canvas.toDataURL("image/png");
    const note = [
      el<HTMLInputElement>("note").value,
      placementError ? `Placement rejected: ${placementError}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const sceneId = scene.value,
      name = `Movement · ${MOTION_SCENES.find((s) => s.id === sceneId)?.name}`;
    const bytes = new TextEncoder().encode(
      `${MOTION_SKETCH}\n${furnitureSignature(furniture)}\n${JSON.stringify(playtest)}\n${screenshot}`,
    );
    const fingerprint = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    outbox.push({
      id: crypto.randomUUID(),
      caseId: `furniture-motion-${sceneId}`,
      name,
      sketch: MOTION_SKETCH,
      furniture,
      furnitureCatalogVersion: FURNITURE_CATALOG_VERSION,
      playtest,
      fingerprint,
      screenshot,
      note,
      verdict: "wrong",
      createdAt: new Date().toISOString(),
    });
    const stored = storeOutbox();
    el<HTMLInputElement>("note").value = "";
    status(
      stored
        ? "Issue captured. Say ‘ready’ in chat when you want me to check it."
        : "Issue captured in memory. Keep this page open until the report is saved.",
    );
    await sync();
  } finally {
    button.disabled = false;
  }
};
async function start() {
  atlas.src = spriteUrl;
  playerImage.src = `${import.meta.env.BASE_URL}assets/sprites/player.png`;
  await Promise.all([
    loadModernInteriorsAtlasIndex(spriteIndexUrl),
    atlas.decode(),
    playerImage.decode(),
  ]);
  const mask = new OffscreenCanvas(atlas.width, atlas.height);
  const maskContext = mask.getContext("2d", { willReadFrequently: true });
  if (!maskContext) throw new Error("Missing source alpha reader");
  alpha = maskContext;
  alpha.drawImage(atlas, 0, 0);
  sheets.set("player", new Spritesheet(playerImage, PLAYER_SPRITE_SIZE, PLAYER_SPRITE_SIZE));
  load();
  ready = true;
  el("sync").textContent = "Ready";
  draw();
  el("app").dataset.ready = "true";
  void sync();
}
void start().catch((error) => status(`Could not start: ${String(error)}`));
setInterval(() => {
  if (outbox.length) void sync();
}, 10000);
requestAnimationFrame(frame);
