import { CAR_PROXY, type Point3 } from "../projection/CarProxy.js";
import bank from "../traffic/vehicles-v1.json" with { type: "json" };

const source = bank.views.find((view) => view.id === CAR_PROXY.sourceView);
const bounds = source?.metadata.colliders[0];
const ax = source?.metadata.anchor[0],
  ay = source?.metadata.anchor[1];
if (!source || !bounds || ax === undefined || ay === undefined)
  throw Error("Missing approved car registration");
/** Source-pixel ground-center origin used by the existing immutable sprite bank. */
export const CAR_SPRITE_ORIGIN = [
  ax + bounds.offsetX,
  ay + bounds.offsetY - bounds.height / 2,
] as const;
/** Source camera registration and +X-forward normalization are asset transforms,
 * never per-entity draw offsets. Z=0 contacts stay on the same ground plane.
 */
export function carVertexToLocal([x, y, z]: Point3): Point3 {
  return [
    -(x + CAR_PROXY.sourceOrigin[0] - CAR_SPRITE_ORIGIN[0]),
    -(y + CAR_PROXY.sourceOrigin[1] - CAR_SPRITE_ORIGIN[1]),
    z,
  ];
}
