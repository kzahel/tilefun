import { required } from "../../art/ArtCatalog.js";
import { sha256 } from "../../art/ArtSource.js";
import { buildLayeredApartmentPlan } from "../ApartmentArchitecture.js";
import { parseFloorPlan } from "../ApartmentFloorPlan.js";
import { buildProfileApartmentPlan } from "../ApartmentWallProfiles.js";
import { drawFurnishedInterior, furnitureSignature } from "../FurnishedInterior.js";
import { drawLayeredInteriorMap } from "../LayeredInteriorMap.js";
import type { ReviewCase } from "./ReviewCases.js";
export function renderInteriorCandidate(
  canvas: HTMLCanvasElement,
  c: ReviewCase,
  atlas: HTMLImageElement,
) {
  const plan = parseFloorPlan(c.sketch),
    map = c.profiles
      ? buildProfileApartmentPlan(plan, c.profiles)
      : buildLayeredApartmentPlan(plan);
  canvas.width = map.width * 16;
  canvas.height = map.pixelHeight;
  const ctx = required(canvas.getContext("2d"));
  ctx.fillStyle = "#171e2a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (c.furniture) drawFurnishedInterior(ctx, atlas, map, plan, c.furniture);
  else drawLayeredInteriorMap(ctx, atlas, map);
  return map;
}
export async function interiorFingerprint(canvas: HTMLCanvasElement, c: ReviewCase) {
  const pixels = required(canvas.getContext("2d")).getImageData(
    0,
    0,
    canvas.width,
    canvas.height,
  ).data;
  const header = new TextEncoder().encode(
    `${c.sketch}\n${canvas.width},${canvas.height}\n${c.furniture ? furnitureSignature(c.furniture) : ""}`,
  );
  const bytes = new Uint8Array(header.length + pixels.length);
  bytes.set(header);
  bytes.set(pixels, header.length);
  return sha256(bytes);
}
