import type { Entity } from "../entities/Entity.js";
import { ENTITY_DEFS } from "../entities/EntityDefs.js";
import { PROMOTED_CHARACTERS } from "./PromotedCharacters.js";

/** Append only: array indices are the compact wire identities for appearances. */
export const PLAYER_MODELS = [
  { id: "player", name: "Classic Player" },
  ...Array.from({ length: 20 }, (_, i) => ({ id: `person${i + 1}`, name: `Person ${i + 1}` })),
  ...PROMOTED_CHARACTERS.filter((c) => c.playerEligible).map((c) => ({
    id: c.sheetKey,
    name: c.name,
  })),
] as const;

export function isPlayerModel(id: unknown): id is string {
  return typeof id === "string" && PLAYER_MODELS.some((model) => model.id === id);
}
export function normalizePlayerModel(id: unknown): string {
  return isPlayerModel(id) ? id : "player";
}

/** Keep entity identity, collider and controller intact; only replace visual structure. */
export function applyPlayerModel(entity: Entity, value: unknown): void {
  if (entity.type !== "player" || !entity.sprite) return;
  const id = normalizePlayerModel(value);
  const def = ENTITY_DEFS[id]?.sprite;
  if (!def) return;
  const changed = (entity.playerModel ?? "player") !== id;
  if (id === "player") delete entity.playerModel;
  else entity.playerModel = id;
  Object.assign(entity.sprite, {
    sheetKey: def.sheetKey,
    spriteWidth: def.spriteWidth,
    spriteHeight: def.spriteHeight,
    frameCount: def.frameCount,
  });
  if (def.drawOffsetY === undefined) delete entity.sprite.drawOffsetY;
  else entity.sprite.drawOffsetY = def.drawOffsetY;
  if (changed) {
    entity.sprite.frameCol = 0;
    entity.sprite.animTimer = 0;
  }
}
