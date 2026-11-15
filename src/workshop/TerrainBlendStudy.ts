import { BlendGraph } from "../autotile/BlendGraph.js";
import { computeTileBlend } from "../autotile/computeTileBlend.js";
import { TerrainAdjacency } from "../autotile/TerrainAdjacency.js";
import { TerrainId, toBaseTerrainId } from "../autotile/TerrainId.js";
import { TerrainEditor } from "../editor/TerrainEditor.js";
import { deriveTerrain } from "../generation/deriveTerrain.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import type { TerrainStrategy } from "../generation/TerrainStrategy.js";
import { World } from "../world/World.js";

export const TERRAIN_STUDIES = [
  {
    id: "pond",
    name: "Current regional pond",
    question:
      "Where do thin sand bands become nubs or isolated islands? This is seed 2026, pond:1:-2, without trees or actors.",
  },
  {
    id: "straight",
    name: "Straight edge",
    question: "Does a long edge read as one continuous boundary, without repeated teeth?",
  },
  {
    id: "corner",
    name: "Outside corner",
    question: "Does the corner have the same border thickness as the straight edge?",
  },
  {
    id: "bay",
    name: "Inside corner",
    question: "Can the artwork turn inward without a hole, spike or stray colour?",
  },
  {
    id: "diagonal",
    name: "Diagonal edge",
    question: "Does a staircase of half-tile samples become a smooth edge or a row of beads?",
  },
  {
    id: "channel",
    name: "Narrow channel",
    question: "Does a one-tile-wide strip stay connected and keep its material?",
  },
  {
    id: "island",
    name: "Single sample island",
    question: "What does the isolated-centre rule draw for one painted sample?",
  },
  {
    id: "junction",
    name: "Three-material junction",
    question: "Do opaque pair tiles overwrite another material where grass, sand and water meet?",
  },
  {
    id: "thin-bands",
    name: "Pond with thin bands",
    question: "Can all four boundaries fit when sand has only half a tile of width?",
  },
  {
    id: "wide-bands",
    name: "Pond with wider bands",
    question:
      "Does giving each sand material two tiles resolve the same shapes? This is a diagnostic comparison, not a proposed world change.",
  },
  {
    id: "paint",
    name: "Editor bridge insertion",
    question:
      "Compare the game's tile brush with bridges off and on. Which material samples does the brush insert?",
  },
] as const;
export type TerrainStudyId = (typeof TERRAIN_STUDIES)[number]["id"];
export const STUDY_GRAPH = new BlendGraph();
export const STUDY_ADJACENCY = new TerrainAdjacency(STUDY_GRAPH);
export const MATERIAL_NAMES: Record<TerrainId, string> = {
  [TerrainId.DeepWater]: "Deep water",
  [TerrainId.ShallowWater]: "Shallow water",
  [TerrainId.Sand]: "Sand",
  [TerrainId.SandLight]: "Light sand",
  [TerrainId.Grass]: "Grass",
  [TerrainId.DirtLight]: "Light dirt",
  [TerrainId.DirtWarm]: "Warm dirt",
  [TerrainId.Playground]: "Playground",
  [TerrainId.Curb]: "Curb",
};
export const MATERIAL_COLOURS: Record<TerrainId, string> = {
  [TerrainId.DeepWater]: "#245d80",
  [TerrainId.ShallowWater]: "#3fa0b0",
  [TerrainId.Sand]: "#dbac52",
  [TerrainId.SandLight]: "#f4d68c",
  [TerrainId.Grass]: "#489456",
  [TerrainId.DirtLight]: "#bb9871",
  [TerrainId.DirtWarm]: "#a76c45",
  [TerrainId.Playground]: "#df996b",
  [TerrainId.Curb]: "#aeb6ba",
};

export interface TerrainStudy {
  world: World;
  x: number;
  y: number;
  size: number;
}

/** Fixtures supply samples, never a replacement blending or rendering algorithm. */
export function terrainStudy(
  id: TerrainStudyId,
  foreground: number = TerrainId.ShallowWater,
  background: TerrainId = TerrainId.Grass,
  bridges = 0,
): TerrainStudy {
  const x = id === "pond" ? 212 : 0,
    y = id === "pond" ? -212 : 0;
  const size = id === "pond" ? 32 : 24;
  const sample = (sx: number, sy: number): number => {
    const dx = sx - 12,
      dy = sy - 12;
    if (id === "thin-bands" || id === "wide-bands") {
      const d = Math.hypot(dx, dy),
        wide = id === "wide-bands";
      return d < 4
        ? TerrainId.DeepWater
        : d < 7
          ? TerrainId.ShallowWater
          : d < (wide ? 9 : 7.5)
            ? TerrainId.Sand
            : d < (wide ? 11 : 8)
              ? TerrainId.SandLight
              : TerrainId.Grass;
    }
    if (id === "junction")
      return sx < 12 ? TerrainId.Grass : sy < 12 ? TerrainId.Sand : TerrainId.ShallowWater;
    const inside =
      id === "straight"
        ? sx < 12
        : id === "corner"
          ? sx < 12 && sy < 12
          : id === "bay"
            ? sx < 12 || sy < 12
            : id === "diagonal"
              ? sx + sy < 24
              : id === "channel"
                ? Math.abs(dy) <= 0.5
                : id === "island"
                  ? sx === 12.5 && sy === 12.5
                  : false;
    return inside ? foreground : background;
  };
  const strategy: TerrainStrategy =
    id === "pond"
      ? createGenerator(createDescriptor("regional", 2026)).terrain
      : {
          generate(chunk, cx, cy) {
            for (let sy = 0; sy <= 32; sy++)
              for (let sx = 0; sx <= 32; sx++)
                chunk.setSubgrid(sx, sy, sample(cx * 16 + sx / 2, cy * 16 + sy / 2));
            deriveTerrain(chunk);
          },
        };
  const world = new World(strategy);
  for (let cy = Math.floor(y / 16) - 1; cy <= Math.floor((y + size) / 16) + 1; cy++)
    for (let cx = Math.floor(x / 16) - 1; cx <= Math.floor((x + size) / 16) + 1; cx++)
      world.getChunk(cx, cy);
  if (id === "paint") {
    const editor = new TerrainEditor(world, () => {}, STUDY_ADJACENCY);
    for (let ty = 8; ty <= 15; ty++)
      for (let tx = 8; tx <= 15; tx++)
        editor.applyTileEdit(tx, ty, foreground, "positive", bridges);
  }
  world.computeAutotile(STUDY_GRAPH);
  return { world, x, y, size };
}

export function studySample(study: TerrainStudy, sx: number, sy: number): number {
  const cx = Math.floor(sx / 32),
    cy = Math.floor(sy / 32);
  return (
    study.world.getChunkIfLoaded(cx, cy)?.getSubgrid(sx - cx * 32, sy - cy * 32) ?? TerrainId.Grass
  );
}

/** Same 3×3 sample order as Autotiler, retained with masks/sheet names for inspection. */
export function inspectStudyTile(study: TerrainStudy, tx: number, ty: number) {
  const sample = (dx: number, dy: number) =>
    toBaseTerrainId(studySample(study, 2 * tx + 1 + dx, 2 * ty + 1 + dy));
  return computeTileBlend(
    studySample(study, 2 * tx + 1, 2 * ty + 1),
    sample(0, -1),
    sample(1, -1),
    sample(1, 0),
    sample(1, 1),
    sample(0, 1),
    sample(-1, 1),
    sample(-1, 0),
    sample(-1, -1),
    STUDY_GRAPH,
  );
}
