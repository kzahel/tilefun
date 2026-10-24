import { DEFAULT_PHYSICAL_HEIGHT } from "../config/constants.js";
import { type AABB, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { surfaceZAt } from "../physics/SurfacePatch.js";
import { TRANSPORTER, transporterWorld } from "../traffic/CarTransporter.js";
import { hasMovingRoof } from "../traffic/RoofSupport.js";
import { presentedTowPosition } from "../traffic/Towing.js";
import { isTransporterSurface, transporterSolids } from "../traffic/TransporterSurface.js";
import { bedPartVertices, bedQueryBounds, DUMP_BED, hasVehicleBed } from "../traffic/VehicleBed.js";
import { entityBody } from "../traffic/VehicleContact.js";
import type { Camera } from "./Camera.js";
import { interpolatePosition, interpolateWz } from "./EntityInterpolation.js";
import type { OverlayFrame } from "./OverlayFrame.js";
import { projectWorld } from "./Projection.js";

/** These describe different queries, not mutually exclusive physics categories. */
export const COLLISION_LAYERS = {
  driving: {
    color: "#ff7373",
    label: "Driving bodies",
    hint: "Rotated boxes used when driving cars.",
  },
  walking: {
    color: "#ffb454",
    label: "Walking obstacles",
    hint: "Vehicle parts and prop walls that block a person.",
  },
  actors: {
    color: "#66baff",
    label: "People & objects",
    hint: "Active character, animal and loose-object bodies.",
  },
  support: {
    color: "#64ff8a",
    label: "Standing surfaces",
    hint: "Where feet can stand; ordinary car roofs use a whole rectangle.",
  },
  bounds: {
    color: "#abb6c4",
    label: "Search bounds",
    hint: "Larger rectangles used to find nearby objects; empty corners may be passable.",
  },
  sprites: {
    color: "#fff177",
    label: "Sprite planes",
    hint: "Flat pictures of people and objects, separate from their physical bodies.",
  },
} as const;
export type CollisionLayer = keyof typeof COLLISION_LAYERS;
export interface CollisionDebugOptions {
  layers: Record<CollisionLayer, boolean>;
  labels: boolean;
  nearbyOnly: boolean;
}
export function defaultCollisionDebugOptions(): CollisionDebugOptions {
  return {
    layers: {
      driving: true,
      walking: true,
      actors: true,
      support: false,
      bounds: false,
      sprites: false,
    },
    labels: false,
    nearbyOnly: true,
  };
}
export interface CollisionPoint {
  x: number;
  y: number;
  z: number;
}
export interface CollisionDebugShape {
  layer: CollisionLayer;
  name: string;
  /** Four vertices for a face/plane; eight for a convex prism. */
  vertices: readonly CollisionPoint[];
  unlimitedHeight?: boolean;
}
const corners = (b: AABB) =>
  [
    [b.left, b.top],
    [b.right, b.top],
    [b.right, b.bottom],
    [b.left, b.bottom],
  ] as const;
function prism(b: AABB, low: number, high: number): CollisionPoint[] {
  return [low, high].flatMap((z) => corners(b).map(([x, y]) => ({ x, y, z })));
}

/** Read-only geometry from the same helpers used by movement and support queries.
 * Driving and on-foot geometry deliberately remain separate, even on one vehicle.
 */
export function entityCollisionDebugShapes(e: Entity): CollisionDebugShape[] {
  // Replicas restore static colliders from type definitions, even for drivers.
  // Parented actors follow their carrier instead of owning independent movement.
  if (!e.collider || e.collider.solid === false || e.parentId !== undefined) return [];
  const bounds = getEntityAABB(e.position, e.collider),
    low = e.wz ?? 0,
    high = low + (e.collider.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT);
  const shapes: CollisionDebugShape[] = [];
  const add = (layer: CollisionLayer, name: string, vertices: readonly CollisionPoint[]) =>
    shapes.push({ layer, name, vertices });
  if (e.type.startsWith("vehicle-v1:")) {
    const b = entityBody(e),
      c = Math.cos(b.angle),
      s = Math.sin(b.angle);
    const vertices = [b.low, b.high].flatMap((z) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x = 0, y = 0]) => ({
        x: b.x + x * b.halfLength * c - y * b.halfWidth * s,
        y: b.y + x * b.halfLength * s + y * b.halfWidth * c,
        z,
      })),
    );
    add("driving", "driving body", vertices);
  }
  let parts: { name: string; vertices: readonly CollisionPoint[] }[];
  if (hasVehicleBed(e))
    parts = DUMP_BED.parts.map((p) => ({ name: p.name, vertices: bedPartVertices(e, p) }));
  else if (isTransporterSurface(e))
    parts = transporterSolids(e).map((vertices, i) => ({
      name:
        ["deck", "cab", "cab guard", "left guide", "right guide", "left ramp", "right ramp"][i] ??
        "part",
      vertices,
    }));
  else
    parts = [
      { name: hasMovingRoof(e) ? "walking body" : "body", vertices: prism(bounds, low, high) },
    ];
  for (const p of parts) {
    add(hasMovingRoof(e) ? "walking" : "actors", p.name, p.vertices);
    if (e.collider.physicalHeight !== undefined)
      add("support", `${p.name} top`, p.vertices.slice(4));
  }
  add(
    "bounds",
    "search bounds",
    prism(hasVehicleBed(e) || isTransporterSurface(e) ? bedQueryBounds(e) : bounds, low, low),
  );
  if (e.sprite && !hasMovingRoof(e)) {
    const s = e.sprite,
      x = e.position.wx,
      y = e.position.wy,
      z = low - (s.drawOffsetY ?? 0);
    add("sprites", "sprite plane", [
      { x: x - s.spriteWidth / 2, y, z },
      { x: x + s.spriteWidth / 2, y, z },
      { x: x + s.spriteWidth / 2, y, z: z + s.spriteHeight },
      { x: x - s.spriteWidth / 2, y, z: z + s.spriteHeight },
    ]);
  }
  return shapes;
}

export function propCollisionDebugShapes(p: Prop): CollisionDebugShape[] {
  const shapes: CollisionDebugShape[] = [];
  for (const [i, c] of (p.walls ?? (p.collider ? [p.collider] : [])).entries()) {
    const bounds = getEntityAABB(p.position, c),
      name = c.surface?.id ?? (p.walls ? `wall ${i + 1}` : "body");
    const surface = c.surface;
    const vertices = surface
      ? [false, true].flatMap((top) =>
          corners(bounds).map(([x, y]) => ({
            x,
            y,
            z: surfaceZAt(surface, bounds, x, y) - (top ? 0 : surface.thickness),
          })),
        )
      : prism(bounds, c.zBase ?? 0, (c.zBase ?? 0) + (c.zHeight ?? 48));
    if (!c.passable)
      shapes.push({
        layer: "walking",
        name: `${name}${!c.surface && c.zHeight === undefined ? " (height unlimited)" : ""}`,
        vertices,
        ...(!surface && c.zHeight === undefined ? { unlimitedHeight: true } : {}),
      });
    if (c.surface || (c.walkableTop && c.zHeight !== undefined))
      shapes.push({ layer: "support", name: `${name} top`, vertices: vertices.slice(4) });
  }
  const colliders = [...(p.walls ?? []), ...(p.collider ? [p.collider] : [])];
  if (colliders.length) {
    const boxes = colliders.map((c) => getEntityAABB(p.position, c));
    shapes.push({
      layer: "bounds",
      name: "search bounds",
      vertices: prism(
        {
          left: Math.min(...boxes.map((b) => b.left)),
          right: Math.max(...boxes.map((b) => b.right)),
          top: Math.min(...boxes.map((b) => b.top)),
          bottom: Math.max(...boxes.map((b) => b.bottom)),
        },
        0,
        0,
      ),
    });
  }
  return shapes;
}

/** Match the scene's displayed XY/Z without changing authoritative objects. */
export function collisionDebugPose(e: Entity, entities: readonly Entity[], alpha: number): Entity {
  let position = interpolatePosition(e.position, e.prevPosition, alpha);
  if (e.towedBy !== undefined) {
    const truck = entities.find((t) => t.id === e.towedBy && t.towTargetId === e.id);
    if (truck)
      position = presentedTowPosition(
        e,
        truck,
        interpolatePosition(truck.position, truck.prevPosition, alpha),
      );
  }
  if (e.transportedBy !== undefined) {
    const truck = entities.find((t) => t.id === e.transportedBy);
    if (truck)
      position = transporterWorld(
        { ...truck, position: interpolatePosition(truck.position, truck.prevPosition, alpha) },
        TRANSPORTER.loadX,
      );
  }
  return { ...e, position, wz: interpolateWz(e, alpha) ?? 0 };
}

export function drawCollisionDebug(
  frame: OverlayFrame,
  camera: Camera,
  entities: readonly Entity[],
  props: readonly Prop[],
  observer: Entity,
  options: CollisionDebugOptions,
  alpha = 1,
): void {
  const focus = collisionDebugPose(observer, entities, alpha).position;
  const labels: { x: number; y: number; width: number }[] = [];
  function draw(owner: { type: string; id: number }, shapes: CollisionDebugShape[]) {
    for (const shape of shapes) {
      if (!options.layers[shape.layer]) continue;
      const vs = shape.vertices;
      const left = Math.min(...vs.map((v) => v.x)),
        right = Math.max(...vs.map((v) => v.x));
      const top = Math.min(...vs.map((v) => v.y)),
        bottom = Math.max(...vs.map((v) => v.y));
      if (
        options.nearbyOnly &&
        (right < focus.wx - 180 ||
          left > focus.wx + 180 ||
          bottom < focus.wy - 180 ||
          top > focus.wy + 180)
      )
        continue;
      const points = vs.map((v) => projectWorld(camera, v.x, v.y, v.z));
      if (
        Math.max(...points.map((p) => p.sx)) < 0 ||
        Math.min(...points.map((p) => p.sx)) > camera.viewportWidth ||
        Math.max(...points.map((p) => p.sy)) < 0 ||
        Math.min(...points.map((p) => p.sy)) > camera.viewportHeight
      )
        continue;
      const color = COLLISION_LAYERS[shape.layer].color;
      const edge = (a: number, b: number) => {
        const p = points[a],
          q = points[b];
        if (p && q) frame.line(p.sx, p.sy, q.sx, q.sy, color);
      };
      for (let i = 0; i < 4; i++) {
        edge(i, (i + 1) % 4);
        if (vs.length === 8 && shape.layer !== "bounds") {
          edge(i + 4, ((i + 1) % 4) + 4);
          edge(i, i + 4);
        }
      }
      if (options.labels) {
        const z0 = Math.min(...vs.map((v) => v.z)),
          z1 = Math.max(...vs.map((v) => v.z));
        const text = `${owner.type.replace("vehicle-v1:", "")} #${owner.id} · ${shape.name} · ${shape.layer === "bounds" ? "XY only" : `Z ${z0.toFixed(0)}–${shape.unlimitedHeight ? "∞" : z1.toFixed(0)}`}`;
        const width = text.length * 6.2 + 6;
        const x = Math.max(
          4,
          Math.min(camera.viewportWidth - width - 4, Math.min(...points.map((p) => p.sx))),
        );
        const anchorY = Math.min(...points.map((p) => p.sy)) - 4;
        for (let attempt = 0; attempt < 24; attempt++) {
          const offset = Math.ceil(attempt / 2) * 18 * (attempt % 2 ? -1 : 1);
          const y = Math.max(16, Math.min(camera.viewportHeight - 4, anchorY + offset));
          if (labels.some((l) => x < l.x + l.width && x + width > l.x && Math.abs(y - l.y) < 18))
            continue;
          labels.push({ x, y, width });
          if (Math.abs(y - anchorY) > 10)
            frame.line(x, y, points[0]?.sx ?? x, points[0]?.sy ?? anchorY, color);
          frame.rect(x - 3, y - 12, width, 16, "#10131de6");
          frame.label(text, x, y, color, "10px monospace");
          break;
        }
      }
    }
  }
  for (const e of entities)
    draw(e, entityCollisionDebugShapes(collisionDebugPose(e, entities, alpha)));
  for (const p of props) draw(p, propCollisionDebugShapes(p));
  if (
    options.layers.actors &&
    observer.parentId === undefined &&
    observer.collider?.solid !== false &&
    observer.collider
  ) {
    const e = collisionDebugPose(observer, entities, alpha),
      p = projectWorld(camera, e.position.wx, e.position.wy, e.wz ?? 0);
    frame.line(p.sx - 4, p.sy, p.sx + 4, p.sy, "#ffffff");
    frame.line(p.sx, p.sy - 4, p.sx, p.sy + 4, "#ffffff");
  }
}
