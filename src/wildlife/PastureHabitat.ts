import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { ActorPlacement } from "../generation/Generator.js";
import type { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { faunaType } from "./Fauna.js";

/** Keep the source and support on the owner's side of a boundary, clear of its body. */
export function pastureSite(a: ActorPlacement) {
  const cx = Math.floor(a.wx / CHUNK_SIZE_PX),
    cy = Math.floor(a.wy / CHUNK_SIZE_PX),
    sign = a.wx - cx * CHUNK_SIZE_PX > 128 ? -1 : 1;
  const elephant = a.type === faunaType("elephant"),
    goat = a.type === faunaType("goat");
  return {
    wx: Math.max(
      cx * CHUNK_SIZE_PX + 6,
      Math.min(cx * CHUNK_SIZE_PX + 250, a.wx + sign * (elephant ? 80 : goat ? 36 : 24)),
    ),
    wy: Math.max(
      cy * CHUNK_SIZE_PX + 6,
      Math.min(
        cy * CHUNK_SIZE_PX + 250,
        a.wy + (elephant || goat ? 0 : a.wy - cy * CHUNK_SIZE_PX > 208 ? -12 : 12),
      ),
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
        .filter(
          (a) => Math.floor(a.wx / CHUNK_SIZE_PX) === x && Math.floor(a.wy / CHUNK_SIZE_PX) === y,
        );
      const actors = [
        ...residents,
        ...(home && ["elephant", "goat"].includes(home.species) ? nature.wildlife(x, y) : []),
      ];
      for (const a of actors) {
        const elephant = a.type === faunaType("elephant"),
          goat = a.type === faunaType("goat");
        if (!elephant && !goat) continue;
        const site = pastureSite(a),
          sign = a.wx - x * CHUNK_SIZE_PX > 128 ? -1 : 1;
        const wx = elephant
          ? site.wx
          : Math.max(x * CHUNK_SIZE_PX + 12, Math.min(x * CHUNK_SIZE_PX + 244, a.wx - sign * 36));
        const wy = elephant
          ? site.wy
          : Math.max(y * CHUNK_SIZE_PX + 12, Math.min(y * CHUNK_SIZE_PX + 244, a.wy - 24));
        if (
          wx + 48 < cx * CHUNK_SIZE_PX ||
          wx - 48 >= (cx + 1) * CHUNK_SIZE_PX ||
          wy + 16 < cy * CHUNK_SIZE_PX ||
          wy - 96 >= (cy + 1) * CHUNK_SIZE_PX
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
