import { getModernInteriorsEntry } from "../../assets/ModernInteriorsAtlasIndex.js";
import type { Prop } from "../../entities/Prop.js";
import type { FirstPersonInterior } from "../../rendering/firstperson/FirstPersonInterior.js";
import { scenarioPropType } from "../../scenarios/ScenarioRecipe.js";
import { furnitureDefinition } from "../FurnitureCatalog.js";
import type { FurnitureMotion } from "../FurnitureMotion.js";

/** The lab's authored map and anchor-based furniture in the shared room scene. */
export function furnitureRoomView(
  model: FurnitureMotion,
  props: readonly Prop[],
): FirstPersonInterior {
  const types = new Map(props.map((prop, index) => [scenarioPropType(index), prop.type]));
  return {
    key: JSON.stringify([model.map, model.furniture]),
    map: model.map,
    shellType: "",
    editable: true,
    furniture: (type) => {
      const placement = model.furniture.find((p) => types.get(type) === `furniture-${p.id}`);
      if (!placement) return undefined;
      const def = furnitureDefinition(placement.asset);
      const object = model.objects.find((o) => o.placement.id === placement.id);
      const rect = getModernInteriorsEntry(def.key)?.rect;
      return (
        rect && {
          rect,
          anchor: def.anchor,
          sortOffsetY: object ? object.depth - object.y : 0,
          floor: def.layer === "floor",
          wall: def.layer === "wall",
        }
      );
    },
  };
}
