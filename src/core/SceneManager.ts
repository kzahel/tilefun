import type { GameContext, GameScene } from "./GameScene.js";

/**
 * Stack-based scene manager.
 *
 * - `push(scene)` — push an overlay (e.g. menu) on top of the current scene
 * - `pop()` — remove the top scene, resume the one below
 * - `replace(scene)` — swap the top scene (e.g. play ↔ edit)
 *
 * **Update**: only the top scene's `update()` is called.
 * **Render**: walks down from top through `transparent` scenes, then renders bottom-up.
 */
export class SceneManager {
  private stack: GameScene[] = [];
  private ctx: GameContext | null = null;

  /** Bind the shared context. Called once during init. */
  setContext(ctx: GameContext): void {
    this.ctx = ctx;
  }

  /** The currently active (top) scene, or null if stack is empty. */
  get current(): GameScene | null {
    return this.stack.at(-1) ?? null;
  }

  /** Number of scenes on the stack. */
  get size(): number {
    return this.stack.length;
  }

  /** Push a new scene onto the stack. */
  push(scene: GameScene): void {
    const ctx = this.requireCtx();
    const prev = this.current;
    if (prev) prev.onPause(ctx);
    this.stack.push(scene);
    scene.onEnter(ctx);
  }

  /** Pop the top scene and resume the one below. */
  pop(): GameScene | undefined {
    const ctx = this.requireCtx();
    const top = this.stack.pop();
    if (top) top.onExit(ctx);
    const next = this.current;
    if (next) next.onResume(ctx);
    return top;
  }

  /** Replace the top scene (pop + push without resuming intermediates). */
  replace(scene: GameScene): void {
    const ctx = this.requireCtx();
    const top = this.stack.pop();
    if (top) top.onExit(ctx);
    this.stack.push(scene);
    scene.onEnter(ctx);
  }

  /** Clear all scenes from the stack. */
  clear(): void {
    const ctx = this.requireCtx();
    while (this.stack.length > 0) {
      const top = this.stack.pop();
      if (top) top.onExit(ctx);
    }
  }

  /** Check if a scene of a given type is on the stack. */
  has<T extends GameScene>(SceneClass: abstract new (...args: never[]) => T): boolean {
    return this.stack.some((s) => s instanceof SceneClass);
  }

  /** Drive the update loop. Only the top scene updates. */
  update(dt: number): void {
    const ctx = this.requireCtx();
    const top = this.current;
    if (top) top.update(dt, ctx);
  }

  /** Drive the render loop. Walks down through transparent scenes, renders bottom-up. */
  render(alpha: number): void {
    if (this.stack.length === 0) return;
    const ctx = this.requireCtx();
    // Find the deepest scene to render (walk down through transparent scenes)
    let start = this.stack.length - 1;
    while (start > 0 && this.stack[start]?.transparent) {
      start--;
    }
    for (let i = start; i < this.stack.length; i++) {
      this.stack[i]?.render(alpha, ctx);
    }
  }

  private requireCtx(): GameContext {
    if (!this.ctx) throw new Error("SceneManager: context not set. Call setContext() first.");
    return this.ctx;
  }
}
