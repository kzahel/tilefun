import type { ActorPlacement } from "../generation/Generator.js";
import type { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { faunaType } from "./Fauna.js";

/** Keep the source and support on the owner's side of a boundary, clear of its body. */
export function pastureSite(a: ActorPlacement) {
  const cx = Math.floor(a.wx / 256),
    cy = Math.floor(a.wy / 256),
    sign = a.wx - cx * 256 > 128 ? -1 : 1;
  const elephant = a.type === faunaType("elephant"),
    goat = a.type === faunaType("goat");
  return {
    wx: Math.max(
      cx * 256 + 6,
      Math.min(cx * 256 + 250, a.wx + sign * (elephant ? 80 : goat ? 36 : 24)),
    ),
    wy: Math.max(
      cy * 256 + 6,
      Math.min(cy * 256 + 250, a.wy + (elephant || goat ? 0 : a.wy - cy * 256 > 208 ? -12 : 12)),
    ),
  };
}
/** Bounded ordinary props; farms and natural owners retain every original identity. */
export function pastureHabitatProps(nature: NaturalLandscape, cx: number, cy: number) {
  const rows = [];
  for (let y = cy - 1; y <= cy + 1; y++)
    for (let x = cx - 1; x <= cx + 1; x++) {
      const bounds = { minX: x * 16, minY: y * 16, maxX: x * 16 + 16, maxY: y * 16 + 16 };
      const home = nature.faunaHome(Math.floor(x / 4), Math.floor(y / 4));
      const residents = nature.farms
        .query(bounds)
        .flatMap((f) => f.actors)
        .filter((a) => Math.floor(a.wx / 256) === x && Math.floor(a.wy / 256) === y);
      const actors = [
        ...residents,
        ...(home && ["elephant", "goat"].includes(home.species) ? nature.wildlife(x, y) : []),
      ];
      for (const a of actors) {
        const elephant = a.type === faunaType("elephant"),
          goat = a.type === faunaType("goat");
        if (!elephant && !goat) continue;
        const site = pastureSite(a),
          sign = a.wx - x * 256 > 128 ? -1 : 1;
        const wx = elephant
          ? site.wx
          : Math.max(x * 256 + 12, Math.min(x * 256 + 244, a.wx - sign * 36));
        const wy = elephant ? site.wy : Math.max(y * 256 + 12, Math.min(y * 256 + 244, a.wy - 24));
        if (
          wx + 48 < cx * 256 ||
          wx - 48 >= (cx + 1) * 256 ||
          wy + 16 < cy * 256 ||
          wy - 96 >= (cy + 1) * 256
        )
          continue;
        rows.push({
          featureId: `${a.featureId}:${elephant ? "fruit-tree" : "browse-rock"}`,
          propType: elephant ? "prop-oak-tree" : "prop-low-rock",
          wx,
          wy,
        });
      }
    }
  return rows;
}
