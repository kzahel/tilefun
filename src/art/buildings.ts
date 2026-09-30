import "./art.css";
import { loadImage } from "../assets/AssetLoader.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import {
  CITY_BUILDING_PREFABS,
  CITY_PREFAB_SOURCE,
  cityPrefabBlock,
} from "../generation/regional/CityBuildingPrefabs.js";
import { required } from "./ArtCatalog.js";
import { drawBuildingShowcase } from "./BuildingShowcase.js";

const $ = <T extends HTMLElement>(id: string) => required(document.getElementById(id)) as T;
const scene = $<HTMLSelectElement>("scene"),
  select = $<HTMLSelectElement>("prefab"),
  canvas = $<HTMLCanvasElement>("building");
const params = new URLSearchParams(location.search);
select.replaceChildren(...CITY_BUILDING_PREFABS.map((p) => new Option(p.name, p.type)));
if (CITY_BUILDING_PREFABS.some((p) => p.type === params.get("prefab")))
  select.value = params.get("prefab") ?? "";
if (["single", "residential", "mixed", "hotel"].includes(params.get("scene") ?? ""))
  scene.value = params.get("scene") ?? "single";
const sheet = new Spritesheet(await loadImage("assets/tilesets/me-complete.png"), 16, 16);
function render() {
  let prefab = required(CITY_BUILDING_PREFABS.find((p) => p.type === select.value));
  const placements =
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
}
for (const control of [scene, select, $("geometry"), $("scale")])
  control.addEventListener("change", render);
select.addEventListener("change", () => {
  scene.value = "single";
  render();
});
render();
