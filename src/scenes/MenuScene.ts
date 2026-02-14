import type { GameContext, GameScene } from "../core/GameScene.js";
import type { WorldMeta } from "../persistence/WorldRegistry.js";

/**
 * Main menu overlay scene.
 * Transparent — the game world renders behind the DOM overlay.
 * Empty update — world is frozen while menu is open.
 */
export class MenuScene implements GameScene {
  readonly transparent = true;
  private worlds: WorldMeta[];

  constructor(worlds: WorldMeta[]) {
    this.worlds = worlds;
  }

  onEnter(gc: GameContext): void {
    gc.mainMenu.show(this.worlds);
  }

  onExit(gc: GameContext): void {
    gc.mainMenu.hide();
  }

  onResume(_gc: GameContext): void {}
  onPause(_gc: GameContext): void {}

  update(_dt: number, _gc: GameContext): void {
    // Intentionally empty — world frozen while menu is open
  }

  render(_alpha: number, _gc: GameContext): void {
    // DOM overlay handles rendering — nothing to draw on canvas
  }
}
