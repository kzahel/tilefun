import { required } from "../art/ArtCatalog.js";
import type { EntityDef } from "../entities/EntityDefs.js";
import approved from "./approved-v1.json" with { type: "json" };
import { createCharacterEntity } from "./CharacterCatalog.js";

/** Immutable gameplay snapshot of the six human-approved images and settings. */
export const PROMOTED_CHARACTERS = approved;
export const CHARACTER_ENTITY_DEFS: Record<string, EntityDef> = Object.fromEntries(
  PROMOTED_CHARACTERS.map((def) => {
    const e = createCharacterEntity(def, def.defaults);
    return [
      def.sheetKey,
      {
        sprite: e.sprite,
        collider: e.collider,
        sortOffsetY: def.defaults.sortOffsetY,
        hasVelocity: true,
        wanderAI: {
          idleMin: 1.5,
          idleMax: 5,
          walkMin: 1,
          walkMax: 3,
          speed: def.defaults.speed,
          directional: true,
        },
      },
    ];
  }),
);
export const CHARACTER_FACTORIES = Object.fromEntries(
  PROMOTED_CHARACTERS.map((def) => [
    def.sheetKey,
    (wx: number, wy: number) => {
      const e = createCharacterEntity(def, def.defaults, wx, wy);
      e.id = 0;
      e.wanderAI = {
        ...required(required(CHARACTER_ENTITY_DEFS[def.sheetKey]).wanderAI),
        state: "idle",
        timer: 2,
        dirX: 0,
        dirY: 0,
      };
      e.tags = new Set(["npc"]);
      return e;
    },
  ]),
);
