import { Game } from "./core/Game.js";

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvas) throw new Error("Canvas element #game not found");

const game = new Game(canvas);
// Expose for debug/testing
// biome-ignore lint/suspicious/noExplicitAny: debug/test hook
(canvas as any).__game = game;
game.init().catch((err) => console.error("[tilefun] init failed:", err));

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy();
  });
}
