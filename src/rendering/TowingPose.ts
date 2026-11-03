import type { Entity } from "../entities/Entity.js";
import profiles from "../traffic/towing-profiles.json" with { type: "json" };
import type { EquipmentPose } from "./EquipmentPose.js";

export const TOW_TRUCK = "vehicle-v1:tow-truck";
/** World pixels; cradle axle is behind the truck's existing rear bumper. */
export const TOW = { hitch: -80, lift: 12, maxAngle: (70 * Math.PI) / 180, reach: 24 } as const;

export const towProfile = (e: Pick<Entity, "type">) =>
  profiles[e.type.slice(11) as keyof typeof profiles];

const pitches = new Map<string, number>();
export function towPitch(e: Pick<EquipmentPose, "type" | "towedBy">) {
  const p = towProfile(e);
  if (!p || e.towedBy === undefined) return 0;
  let pitch = pitches.get(e.type);
  if (pitch === undefined) {
    let low = 0,
      high = Math.PI / 3;
    for (let i = 0; i < 32; i++) {
      const a = (low + high) / 2,
        c = Math.cos(a),
        s = Math.sin(a);
      const clearance =
        (p.front - p.rear) * s +
        (p.frontZ - p.rearZ) * p.heightScale * c -
        Math.hypot(p.radius * s, p.radius * p.heightScale * c) +
        Math.hypot(p.rearRadius * s, p.rearRadius * p.heightScale * c);
      if (clearance < TOW.lift) low = a;
      else high = a;
    }
    pitch = (low + high) / 2;
    pitches.set(e.type, pitch);
  }
  return pitch;
}
export function towFrontOffset(e: Pick<EquipmentPose, "type" | "towedBy">) {
  const p = towProfile(e);
  if (!p) return 0;
  const pitch = towPitch(e);
  return (
    p.rear +
    (p.front - p.rear) * Math.cos(pitch) +
    (p.rearZ - p.frontZ) * p.heightScale * Math.sin(pitch)
  );
}
/** Rotate about the rear tire's ground contact. Ground/body origin stays stable. */
export function towMeshOffset(e: Pick<EquipmentPose, "type" | "towedBy">) {
  const p = towProfile(e),
    pitch = towPitch(e);
  if (!p || !pitch) return { x: 0, z: 0 };
  const c = Math.cos(pitch),
    s = Math.sin(pitch),
    r = p.rearZ * p.heightScale;
  // The fitted tire is an ellipse in X/Z. Its lowest point still touches ground
  // after pitching, while the same-size front tire clears it by exactly lift.
  return {
    x: p.rear * (1 - c) + r * s,
    z: -p.rear * s + Math.hypot(p.rearRadius * s, p.rearRadius * p.heightScale * c) - r * c,
  };
}
