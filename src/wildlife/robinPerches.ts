import type { Prop } from "../entities/Prop.js";
import type { RobinPerch } from "./Robin.js";

/** Reuse actual ordinary tree crown surfaces; moved/deleted trees update immediately.
 * The crown's near edge leaves the whole feet collider on its surface; shared
 * elevated depth ordering draws the bird above the canopy. */
export function robinTreePerches(props: readonly Prop[]): RobinPerch[] {
  return props.flatMap((p) => {
    if (p.type !== "prop-oak-tree" && p.type !== "prop-palm-tree") return [];
    const crown = p.walls?.find((w) => w.walkableTop && w.passable && w.zHeight !== undefined);
    return crown
      ? [
          {
            wx: p.position.wx + crown.offsetX,
            wy: p.position.wy + crown.offsetY - 1,
            z: (crown.zBase ?? 0) + (crown.zHeight ?? 0),
          },
        ]
      : [];
  });
}
