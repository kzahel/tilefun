import { Direction } from "../entities/Entity.js";

/**
 * Ball aim: the movement direction (diagonal joysticks included); standing still,
 * where a first-person camera looks, else the sprite's facing (south without one).
 */
export function throwDirection(
  movement: { dx: number; dy: number },
  facing: Direction | undefined,
  look?: { x: number; y: number },
): { dirX: number; dirY: number } {
  if (movement.dx !== 0 || movement.dy !== 0) {
    const len = Math.sqrt(movement.dx * movement.dx + movement.dy * movement.dy) || 1;
    return { dirX: movement.dx / len, dirY: movement.dy / len };
  }
  if (look) return { dirX: look.x, dirY: look.y };
  switch (facing) {
    case Direction.Right:
      return { dirX: 1, dirY: 0 };
    case Direction.Left:
      return { dirX: -1, dirY: 0 };
    case Direction.Up:
      return { dirX: 0, dirY: -1 };
    default:
      return { dirX: 0, dirY: 1 };
  }
}
