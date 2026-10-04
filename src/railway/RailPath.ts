import { required } from "../art/ArtCatalog.js";
/** Horizontal alignment in world pixels. Arcs have signed sweeps (screen Y grows south). */
export type RailSegment =
  | { kind: "line"; x: number; y: number; endX: number; endY: number }
  | { kind: "arc"; x: number; y: number; radius: number; angle: number; sweep: number };
export interface RailPath {
  segments: RailSegment[];
  closed: boolean;
  /** Service anchor distances, ordered along the alignment. */
  stops: { distance: number; name: string }[];
  reverse?: boolean;
}
export interface RailPose {
  x: number;
  y: number;
  angle: number;
}
const TAU = Math.PI * 2;
export const wrapDistance = (d: number, length: number) => ((d % length) + length) % length;
export function segmentLength(s: RailSegment): number {
  return s.kind === "line" ? Math.hypot(s.endX - s.x, s.endY - s.y) : s.radius * Math.abs(s.sweep);
}
function segmentPose(s: RailSegment, distance: number): RailPose {
  if (s.kind === "line") {
    const angle = Math.atan2(s.endY - s.y, s.endX - s.x);
    return { x: s.x + Math.cos(angle) * distance, y: s.y + Math.sin(angle) * distance, angle };
  }
  const angle = s.angle + (distance / s.radius) * Math.sign(s.sweep);
  return {
    x: s.x + s.radius * Math.cos(angle),
    y: s.y + s.radius * Math.sin(angle),
    angle: angle + (Math.sign(s.sweep) * Math.PI) / 2,
  };
}
export class RailAlignment {
  readonly length: number;
  readonly bounds: { minX: number; minY: number; maxX: number; maxY: number };
  constructor(readonly path: RailPath) {
    if (
      !path.segments.length ||
      path.segments.length > 64 ||
      typeof path.closed !== "boolean" ||
      (path.reverse !== undefined && typeof path.reverse !== "boolean")
    )
      throw Error("Invalid rail alignment");
    for (const s of path.segments) {
      if (
        !Object.values(s)
          .filter((v) => typeof v === "number")
          .every((v) => Number.isFinite(v) && Math.abs(v as number) <= 1e7) ||
        segmentLength(s) <= 0 ||
        (s.kind === "arc" && (s.radius < 192 || Math.abs(s.sweep) > Math.PI))
      )
        throw Error("Invalid rail segment or tight bend");
    }
    this.length = path.segments.reduce((n, s) => n + segmentLength(s), 0);
    if (this.length < 512 || this.length > 65536) throw Error("Invalid rail length");
    const count = path.closed ? path.segments.length : path.segments.length - 1;
    for (let i = 0; i < count; i++) {
      const a = required(path.segments[i]),
        b = required(path.segments[(i + 1) % path.segments.length]);
      const end = segmentPose(a, segmentLength(a)),
        start = segmentPose(b, 0);
      if (
        Math.hypot(end.x - start.x, end.y - start.y) > 0.001 ||
        Math.abs(Math.atan2(Math.sin(end.angle - start.angle), Math.cos(end.angle - start.angle))) >
          0.001
      )
        throw Error("Rail segments must meet tangentially");
    }
    if (
      path.stops.length < 2 ||
      path.stops.length > 16 ||
      path.stops.some(
        (s, i) =>
          !s.name ||
          !Number.isFinite(s.distance) ||
          s.distance < (path.closed ? 0 : 240) ||
          s.distance > this.length - (path.closed ? 0.001 : 240) ||
          (i > 0 && s.distance - required(path.stops[i - 1]).distance < 384),
      ) ||
      (path.closed &&
        this.length - required(path.stops.at(-1)).distance + required(path.stops[0]).distance < 384)
    )
      throw Error("Invalid rail stops or train overhang");
    const points = this.samples(16);
    this.bounds = {
      minX: Math.min(...points.map((p) => p.x)) - 192,
      maxX: Math.max(...points.map((p) => p.x)) + 192,
      minY: Math.min(...points.map((p) => p.y)) - 192,
      maxY: Math.max(...points.map((p) => p.y)) + 192,
    };
  }
  sample(distance: number): RailPose {
    let d = this.path.closed
      ? wrapDistance(distance, this.length)
      : Math.max(0, Math.min(this.length, distance));
    for (const s of this.path.segments) {
      const length = segmentLength(s);
      if (d <= length) return segmentPose(s, d);
      d -= length;
    }
    const last = required(this.path.segments.at(-1));
    return segmentPose(last, segmentLength(last));
  }
  samples(spacing: number): RailPose[] {
    const steps = Math.ceil(this.length / spacing);
    return Array.from({ length: steps + 1 }, (_, i) => this.sample((i * this.length) / steps));
  }
}
const alignments = new WeakMap<RailPath, RailAlignment>();
export function railAlignment(path: RailPath): RailAlignment {
  let alignment = alignments.get(path);
  if (!alignment) {
    alignment = new RailAlignment(path);
    alignments.set(path, alignment);
  }
  return alignment;
}
/** Rigid body between two bogies. The body follows their chord rather than the center tangent. */
export function carriagePose(alignment: RailAlignment, distance: number): RailPose {
  const a = alignment.sample(distance - 36),
    b = alignment.sample(distance + 36);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}
export function headingFrame(angle: number): number {
  return Math.round((wrapDistance(angle, TAU) / TAU) * 256) % 256;
}
