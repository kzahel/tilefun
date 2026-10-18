import { RoadType } from "./RoadType.js";

export function isRaceSurface(type: number): boolean {
  return type >= RoadType.RaceCurbRed && type <= RoadType.RaceLane;
}
/** Code-native paint rasterized once into the shared Canvas/GPU terrain cache. */
export function drawRaceSurface(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  type: number,
  x: number,
  y: number,
): void {
  ctx.fillStyle =
    type === RoadType.RaceCurbRed
      ? "#cf4545"
      : type === RoadType.RaceCurbWhite
        ? "#f2ebd7"
        : "#50545a";
  ctx.fillRect(x, y, 16, 16);
  if (type === RoadType.RaceStart) {
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 4; col++) {
        ctx.fillStyle = (row + col) % 2 ? "#262a30" : "#f2ebd7";
        ctx.fillRect(x + col * 4, y + row * 4, 4, 4);
      }
  } else if (type === RoadType.RaceLane) {
    ctx.fillStyle = "#e9e3ce";
    ctx.fillRect(x + 6, y + 6, 4, 4);
  }
}
