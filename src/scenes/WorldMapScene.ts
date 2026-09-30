import type { GameContext, GameScene } from "../core/GameScene.js";
import type { WorldMap } from "../ui/WorldMap.js";

/** Keep the game connected and rendering while map gestures own input. */
export class WorldMapScene implements GameScene {
  readonly transparent = true;
  constructor(private readonly map: WorldMap) {}
  onEnter(_gc: GameContext): void {
    this.map.show();
  }
  onExit(_gc: GameContext): void {
    this.map.hide();
  }
  onPause(_gc: GameContext): void {
    this.map.hide();
  }
  onResume(_gc: GameContext): void {
    this.map.show();
  }
  update(_dt: number, _gc: GameContext): void {}
  render(_alpha: number, _gc: GameContext): void {}
}
