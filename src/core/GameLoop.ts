import { TICK_RATE } from "../config/constants.js";

/** Fixed simulation timestep in seconds. */
const FIXED_DT = 1 / TICK_RATE;

/** Maximum frame time cap to prevent spiral of death on lag spikes. */
const MAX_FRAME_TIME = 0.25;

export interface GameLoopCallbacks {
  update(dt: number): void;
  render(alpha: number): void;
}

/**
 * Fixed-timestep game loop with interpolation alpha.
 *
 * Runs update() at a fixed rate (TICK_RATE Hz) regardless of display refresh
 * rate. The render() callback receives an alpha value [0, 1) representing how
 * far between two fixed updates the current frame falls, for smooth
 * interpolation on 120Hz/240Hz displays.
 */
export class GameLoop {
  private accumulator = 0;
  private lastTime = 0;
  private running = false;
  private rafId = 0;
  private callbacks: GameLoopCallbacks;
  timeScale = 1;

  constructor(callbacks: GameLoopCallbacks) {
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now() / 1000;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  /**
   * Process one frame from an external time source (e.g. XR session rAF).
   * Call stop() first to prevent the internal rAF from also ticking.
   */
  externalTick(nowMs: number): void {
    const now = nowMs / 1000;
    let frameTime = now - this.lastTime;
    this.lastTime = now;

    if (frameTime > MAX_FRAME_TIME) {
      frameTime = MAX_FRAME_TIME;
    }

    this.accumulator += frameTime * this.timeScale;

    while (this.accumulator >= FIXED_DT) {
      this.callbacks.update(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }

    const alpha = this.accumulator / FIXED_DT;
    this.callbacks.render(alpha);
  }

  private tick = (nowMs: number): void => {
    if (!this.running) return;

    const now = nowMs / 1000;
    let frameTime = now - this.lastTime;
    this.lastTime = now;

    if (frameTime > MAX_FRAME_TIME) {
      frameTime = MAX_FRAME_TIME;
    }

    this.accumulator += frameTime * this.timeScale;

    while (this.accumulator >= FIXED_DT) {
      this.callbacks.update(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }

    const alpha = this.accumulator / FIXED_DT;
    this.callbacks.render(alpha);

    this.rafId = requestAnimationFrame(this.tick);
  };
}
