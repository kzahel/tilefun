import { furnitureSignature } from "./FurnishedInterior.js";
import { type FurniturePlacement, furnitureDefinition } from "./FurnitureCatalog.js";
import { MOTION_SKETCH } from "./FurnitureMotion.js";
import { FURNITURE_PHYSICS_VERSION, type FurnitureBodies } from "./FurniturePhysics.js";
import type { ReviewFeedback } from "./review/ReviewFeedback.js";

/** Scene configuration, independent of the player's pose and diagnostic overlays. */
export function motionSceneSignature(
  furniture: readonly FurniturePlacement[],
  bodies: FurnitureBodies,
  gravityScale: number,
): string {
  return JSON.stringify({
    version: FURNITURE_PHYSICS_VERSION,
    sketch: MOTION_SKETCH,
    furniture: furnitureSignature(furniture),
    bodies,
    gravityScale,
    // Only low, deep bodies can change order under this rendering fix. Keep
    // approvals for unaffected tall/short objects, including custom heights.
    ...(furniture.some((p) => {
      const body = bodies[p.id];
      return body && body.height + furnitureDefinition(p.asset).footprint.y < 0;
    })
      ? { supportDepthVersion: 1 }
      : {}),
  });
}
export function motionVerdict(
  records: readonly ReviewFeedback[],
  id: string,
  signature: string,
): "good" | "wrong" | "unchecked" {
  const latest = records
    .filter((r) => r.caseId === `furniture-motion-${id}`)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .at(-1);
  return latest?.playtest?.sceneSignature === signature && latest.verdict !== "clear"
    ? latest.verdict
    : "unchecked";
}
/** Advance in catalog order, wrapping once, excluding the scene just reviewed. */
export function nextUncheckedScene(
  ids: readonly string[],
  current: string,
  unchecked: (id: string) => boolean,
): string | undefined {
  const start = ids.indexOf(current);
  for (let offset = 1; offset < ids.length; offset++) {
    const id = ids[(Math.max(0, start) + offset) % ids.length];
    if (id && unchecked(id)) return id;
  }
  return undefined;
}
