import type { GameContext, GameScene } from "../core/GameScene.js";

/**
 * Prop catalog overlay scene.
 * Transparent — the editor renders behind the DOM overlay.
 * Empty update — world is frozen while catalog is open.
 */
export class CatalogScene implements GameScene {
  readonly transparent = true;

  onEnter(gc: GameContext): void {
    gc.propCatalog.show();
  }

  onExit(gc: GameContext): void {
    gc.propCatalog.hide();
  }

  onResume(_gc: GameContext): void {}
  onPause(_gc: GameContext): void {}

  update(_dt: number, _gc: GameContext): void {
    // Intentionally empty — world frozen while catalog is open
  }

  render(_alpha: number, _gc: GameContext): void {
    // DOM overlay handles rendering — nothing to draw on canvas
  }
}
