import { CHUNK_SIZE_PX, TILE_SIZE } from "../config/constants.js";
import { strokeCells } from "../patterns/GridStroke.js";
import type { TreeBrushEditor } from "../patterns/TreeBrushEditor.js";
import type { ClientMessage } from "../shared/protocol.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { PlayerSession } from "./PlayerSession.js";

/** Small readiness halo includes adjacency edits and destination collision support. */
export function mutationRange(
  msg: ClientMessage,
  session: PlayerSession,
  trees: TreeBrushEditor,
): ChunkRange | undefined {
  let points: { x: number; y: number }[] = [];
  let halo = 32;
  let haloY = 32;
  if (msg.type === "edit-pattern") {
    points = strokeCells([msg.start, msg.end], "horizontal").map((p) => ({
      x: p.x * TILE_SIZE,
      y: p.y * TILE_SIZE,
    }));
    halo = 129 * TILE_SIZE;
  } else if (msg.type === "edit-pattern-history") {
    return trees.historyRange(session.clientId, msg.direction);
  } else if ("wx" in msg && "wy" in msg) points = [{ x: msg.wx, y: msg.wy }];
  else if ("tx" in msg && "ty" in msg) {
    points = [{ x: msg.tx * TILE_SIZE, y: msg.ty * TILE_SIZE }];
    if (msg.type === "edit-elevation") {
      if (!Number.isInteger(msg.gridSize) || msg.gridSize < 1 || msg.gridSize > 32)
        throw new Error("Elevation brush is too large.");
      halo += msg.gridSize * TILE_SIZE;
      haloY = halo;
    }
  } else if ("gsx" in msg && "gsy" in msg)
    points = [{ x: (msg.gsx * TILE_SIZE) / 2, y: (msg.gsy * TILE_SIZE) / 2 }];
  else if (msg.type === "throw-ball")
    points = [{ x: session.player.position.wx, y: session.player.position.wy }];
  if (!points.length) return;
  if (
    !points.every(
      (p) =>
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        Math.abs(p.x) < 2 ** 28 &&
        Math.abs(p.y) < 2 ** 28,
    )
  )
    throw new Error("Invalid edit position.");
  return {
    minCx: Math.floor((Math.min(...points.map((p) => p.x)) - halo) / CHUNK_SIZE_PX),
    maxCx: Math.floor((Math.max(...points.map((p) => p.x)) + halo) / CHUNK_SIZE_PX),
    minCy: Math.floor((Math.min(...points.map((p) => p.y)) - haloY) / CHUNK_SIZE_PX),
    maxCy: Math.floor((Math.max(...points.map((p) => p.y)) + haloY) / CHUNK_SIZE_PX),
  };
}
