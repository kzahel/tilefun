import { vehicleNoseHeading } from "../traffic/Vehicle.js";
import type { EquipmentPose } from "./EquipmentPose.js";

export { TRANSPORTER } from "../traffic/Transporter.js";
export function transporterWorld(truck: EquipmentPose, x: number, y = 0) {
  const h = vehicleNoseHeading(truck),
    c = Math.cos(h),
    s = Math.sin(h);
  return { wx: truck.position.wx + x * c - y * s, wy: truck.position.wy + x * s + y * c };
}
