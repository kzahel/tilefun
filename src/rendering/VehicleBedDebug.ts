import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { type BedPart, bedWorldPoint, DUMP_BED } from "../traffic/VehicleBed.js";
import type { Camera } from "./Camera.js";
import type { OverlayFrame } from "./OverlayFrame.js";

/** X-ray overlays consume exactly the same floor/wall profile as physics. */
export function drawVehicleBedDebug(
  frame: OverlayFrame,
  camera: Camera,
  truck: Entity,
  actor: Entity,
  contents: readonly Entity[] = [],
) {
  function prism(part: BedPart, color: string) {
    const vertices = [part.bottom, part.top].flatMap((r, index) =>
      [
        [r.left, r.top],
        [r.right, r.top],
        [r.right, r.bottom],
        [r.left, r.bottom],
      ].map(([x = 0, y = 0]) => {
        const point = bedWorldPoint(truck, x, y);
        return camera.worldToScreen(
          point.wx,
          point.wy - (truck.wz ?? 0) - (index ? part.z1 : part.z0),
        );
      }),
    );
    for (let i = 0; i < 4; i++)
      for (const [a, b] of [
        [i, (i + 1) % 4],
        [i + 4, ((i + 1) % 4) + 4],
        [i, i + 4],
      ]) {
        const p = vertices[a ?? 0],
          q = vertices[b ?? 0];
        if (p && q) frame.line(p.sx, p.sy, q.sx, q.sy, color);
      }
  }
  for (const part of DUMP_BED.parts)
    prism(
      part,
      part.name === "floor"
        ? "#64ff8a"
        : part.name === "cab" || part.name === "chassis"
          ? "#abb6c477"
          : "#ff7373",
    );
  for (const player of [actor, ...contents]) {
    if (player.collider) {
      const box = getEntityAABB(player.position, player.collider),
        z = player.wz ?? 0;
      const points = [z, z + (player.collider.physicalHeight ?? 12)].flatMap((height) =>
        [
          [box.left, box.top],
          [box.right, box.top],
          [box.right, box.bottom],
          [box.left, box.bottom],
        ].map(([x = 0, y = 0]) => camera.worldToScreen(x, y - height)),
      );
      for (let i = 0; i < 4; i++)
        for (const [a = 0, b = 0] of [
          [i, (i + 1) % 4],
          [i + 4, ((i + 1) % 4) + 4],
          [i, i + 4],
        ]) {
          const p = points[a],
            q = points[b];
          if (p && q) frame.line(p.sx, p.sy, q.sx, q.sy, "#66baff");
        }
    }
    if (player.sprite) {
      const s = player.sprite,
        z = player.wz ?? 0;
      const p = camera.worldToScreen(
        player.position.wx - s.spriteWidth / 2,
        player.position.wy - z + (s.drawOffsetY ?? 0) - s.spriteHeight,
      );
      frame.rect(
        p.sx,
        p.sy,
        s.spriteWidth * camera.scale,
        s.spriteHeight * camera.scale,
        "",
        "#fff177",
      );
      const foot = camera.worldToScreen(player.position.wx, player.position.wy - z);
      frame.line(foot.sx - 4, foot.sy, foot.sx + 4, foot.sy, "#ffffff");
      frame.line(foot.sx, foot.sy - 4, foot.sx, foot.sy + 4, "#ffffff");
    }
  }
}
