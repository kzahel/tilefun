import type { GameContext, GameScene } from "../core/GameScene.js";
import type { IdeaSnapshot } from "../ideas/captureIdea.js";
import { IdeaDialog } from "../ideas/IdeaDialog.js";

/** The modal owns input; existing game scene pause/resume handles play/edit controls. */
export class IdeaScene implements GameScene {
  readonly transparent = true;
  private dialog: IdeaDialog | undefined;
  constructor(private snapshot: IdeaSnapshot) {}
  onEnter(gc: GameContext) {
    gc.actions.detach();
    gc.audioManager.setIdeaDucking(true);
    this.dialog = new IdeaDialog(this.snapshot, gc.audioManager, () => {
      if (gc.scenes.current === this) gc.scenes.pop();
    });
  }
  onExit(gc: GameContext) {
    this.dialog?.destroy();
    gc.audioManager.setIdeaDucking(false);
    gc.actions.attach();
  }
  onPause(_gc: GameContext) {}
  onResume(_gc: GameContext) {}
  update(_dt: number, _gc: GameContext) {}
  render(_alpha: number, _gc: GameContext) {}
}
