import type { GameContext, GameScene } from "../core/GameScene.js";

export class InteriorCatalogScene implements GameScene {
  readonly transparent = true;

  onEnter(gc: GameContext): void {
    gc.interiorCatalog.show();
  }

  onExit(gc: GameContext): void {
    gc.interiorCatalog.hide();
  }

  onResume(_gc: GameContext): void {}
  onPause(_gc: GameContext): void {}

  update(_dt: number, _gc: GameContext): void {
    // DOM overlay handles interaction while the world is paused.
  }

  render(_alpha: number, _gc: GameContext): void {
    // DOM overlay handles rendering.
  }
}
