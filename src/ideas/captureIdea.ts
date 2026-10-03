import { IDEA_IMAGE_LIMIT, type IdeaContext } from "./PlayIdea.js";
export interface IdeaSnapshot {
  screenshot: string;
  context: IdeaContext;
}
export function captureIdea(
  canvas: HTMLCanvasElement,
  worldId: string,
  x: number,
  y: number,
): IdeaSnapshot {
  const copy = document.createElement("canvas");
  const scale = Math.min(1, 640 / Math.max(canvas.width, canvas.height));
  copy.width = Math.max(1, Math.round(canvas.width * scale));
  copy.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = copy.getContext("2d");
  if (!ctx) throw new Error("Couldn't take a picture of the game.");
  ctx.drawImage(canvas, 0, 0, copy.width, copy.height);
  let screenshot = copy.toDataURL("image/png");
  if (screenshot.length > IDEA_IMAGE_LIMIT) {
    const small = document.createElement("canvas");
    small.width = Math.max(1, Math.floor(copy.width / 2));
    small.height = Math.max(1, Math.floor(copy.height / 2));
    small.getContext("2d")?.drawImage(copy, 0, 0, small.width, small.height);
    screenshot = small.toDataURL("image/png");
  }
  return {
    screenshot,
    context: {
      worldId,
      generation: canvas.dataset.generation ?? "",
      x,
      y,
      build: import.meta.env.VITE_BUILD_ID,
      capturedAt: new Date().toISOString(),
    },
  };
}
