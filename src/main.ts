import { Game } from "./core/Game.js";

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvas) throw new Error("Canvas element #game not found");

const game = new Game(canvas);
// Expose for debug/testing
(canvas as any).__game = game;
game.init();
