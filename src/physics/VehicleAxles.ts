import { vehicleHandling } from "../traffic/VehicleHandling.js";
import contacts from "../traffic/vehicle-ground-contacts.json" with { type: "json" };
import { PHYSICS_PIXELS_PER_METRE as SCALE } from "./PhysicsDefaults.js";

/** One-time authored wheel geometry/handling; independent of per-step scratch. */
export function vehicleAxles(type: string, width: number, depth: number, height: number) {
  const radius = Math.min(5, depth * 0.18) / SCALE;
  const profile = contacts[type.slice(11) as keyof typeof contacts]?.contacts;
  const mounts =
    profile && profile.length >= 4
      ? profile
      : [
          { name: "FL", x: width * 0.34, y: depth * 0.4 },
          { name: "FR", x: width * 0.34, y: -depth * 0.4 },
          { name: "RL", x: -width * 0.34, y: depth * 0.4 },
          { name: "RR", x: -width * 0.34, y: -depth * 0.4 },
        ];
  const wheelbase = Math.max(...mounts.map((p) => p.x)) - Math.min(...mounts.map((p) => p.x));
  const rest = 0.3,
    sag = 31.25 / (4 * 120);
  const front = mounts.map((p) => p.name.startsWith("F"));
  const handling = vehicleHandling(type);
  const { drive } = handling;
  const driven = front.map((front) => drive === "all" || front === (drive === "front"));
  const drivenWheels = driven.filter(Boolean).length;
  const connections = mounts.map((p) => ({
    x: p.x / SCALE,
    y: -height / 2 / SCALE + radius + rest - sag,
    z: p.y / SCALE,
  }));
  return { radius, wheelbase, front, handling, driven, drivenWheels, connections };
}
