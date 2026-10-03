import { Direction, type Entity } from "../entities/Entity.js";

/** Appearance/geometry only. Controllers and gameplay eligibility are separate. */
export interface CharacterDefinition {
  id: string;
  name: string;
  sheetKey: string;
  image: string;
  frameSize: number;
  frameCount: number;
  playerEligible: boolean;
  defaults: CharacterSettings;
}
export interface CharacterSettings {
  drawOffsetY: number;
  sortOffsetY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  depth: number;
  physicalHeight: number;
  speed: number;
  fps: number;
}
export const CHARACTER_FIELDS: {
  key: keyof CharacterSettings;
  label: string;
  min: number;
  max: number;
}[] = [
  { key: "drawOffsetY", label: "Sprite vertical offset", min: -32, max: 32 },
  { key: "sortOffsetY", label: "Depth sorting offset", min: -32, max: 32 },
  { key: "offsetX", label: "Collider X offset", min: -32, max: 32 },
  { key: "offsetY", label: "Collider Y offset", min: -32, max: 32 },
  { key: "width", label: "Ground width", min: 1, max: 64 },
  { key: "depth", label: "Ground depth", min: 1, max: 64 },
  { key: "physicalHeight", label: "Physical height", min: 1, max: 64 },
  { key: "speed", label: "Walk speed", min: 1, max: 120 },
  { key: "fps", label: "Animation FPS", min: 1, max: 24 },
];
export function parseCharacterSettings(value: unknown): CharacterSettings {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid character settings");
  const result = {} as CharacterSettings;
  for (const { key, label, min, max } of CHARACTER_FIELDS) {
    const n = (value as Record<string, unknown>)[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max)
      throw new Error(`${label} must be between ${min} and ${max}.`);
    result[key] = n;
  }
  return result;
}
export const CHARACTERS: readonly CharacterDefinition[] = (
  [
    ["tiger", "Tiger"],
    ["cat", "Tuxedo Cat"],
    ["dog", "Floppy Dog"],
    ["person", "Trail Explorer"],
    ["squirrel", "Russet Squirrel"],
    ["bear", "Brown Bear"],
  ] as const
).map(([id, name]) => ({
  id,
  name,
  sheetKey: `character-${id}-v1`,
  image:
    id === "tiger"
      ? "demos/blender-tiger/tiger-finished-32.png"
      : `demos/pixel-characters/${id}-32.png`,
  frameSize: 32,
  frameCount: 4,
  playerEligible: true,
  defaults: {
    drawOffsetY: 5,
    sortOffsetY: 0,
    offsetX: 0,
    offsetY: 0,
    width: id === "bear" ? 14 : 10,
    depth: 6,
    physicalHeight: 24,
    speed: 20,
    fps: 4,
  },
}));
export function createCharacterEntity(
  def: CharacterDefinition,
  settings: CharacterSettings,
  wx = 0,
  wy = 0,
): Entity {
  const s = parseCharacterSettings(settings);
  return {
    id: 1,
    type: def.sheetKey,
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    wz: 0,
    sprite: {
      sheetKey: def.sheetKey,
      spriteWidth: def.frameSize,
      spriteHeight: def.frameSize,
      frameCount: def.frameCount,
      frameDuration: 1000 / s.fps,
      drawOffsetY: s.drawOffsetY,
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      direction: Direction.Down,
      moving: false,
    },
    collider: {
      offsetX: s.offsetX,
      offsetY: s.offsetY,
      width: s.width,
      height: s.depth,
      physicalHeight: s.physicalHeight,
      clientSolid: true,
    },
    sortOffsetY: s.sortOffsetY,
    wanderAI: null,
  };
}
