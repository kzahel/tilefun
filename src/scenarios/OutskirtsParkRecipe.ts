import { TerrainId } from "../autotile/TerrainId.js";
import { createCampfire } from "../entities/Campfire.js";
import type { Entity } from "../entities/Entity.js";
import { DOCK_PLANKS, fenceRun, type ParkPiece, parkProp } from "../entities/ParkKit.js";
import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
import { TREE_HOUSE_LAYOUT, treeHousePoint, treeHouseProp } from "../entities/TreeHouse.js";
import { forestRowProp, forestRowType } from "../patterns/ForestThicket.js";
import { required } from "../shared/required.js";
import { createDeer } from "../wildlife/Deer.js";
import { createFrog } from "../wildlife/Frog.js";
import { createMallard } from "../wildlife/Mallard.js";
import { createRabbit } from "../wildlife/Rabbit.js";
import { createRobin } from "../wildlife/Robin.js";
import { robinTreePerches } from "../wildlife/robinPerches.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";

/**
 * Outskirts nature park: a camping-sign entrance and dirt trails linking a
 * campground, a fishing pond with a dock, the climbable tree house and a fenced
 * wildlife meadow, with woodland behind. World pixels; 16px tiles.
 */
export const PARK_BOUNDS = { left: -640, top: -512, right: 640, bottom: 448 } as const;
export const CAMP = { wx: -416, wy: 72 } as const;
export const POND = { tx: 24, ty: 4.5, rx: 8, ry: 5.5 } as const;
export const DOCK = { wx: 320, wy: 96 } as const;
export const MEADOW = { left: 128, top: -400, right: 432, bottom: -208 } as const;
export const PARK_TREE_HOUSE = { wx: -232, wy: -80 } as const;

const ladder = TREE_HOUSE_LAYOUT.ladder;
const ladderFoot = treeHousePoint(
  PARK_TREE_HOUSE.wx,
  PARK_TREE_HOUSE.wy,
  (ladder.left + ladder.right) / 2,
  ladder.bottom + 14,
);

export const PARK_STARTS = {
  entrance: { position: { wx: 0, wy: 436 }, z: 0 },
  campfire: { position: { wx: CAMP.wx + 24, wy: CAMP.wy + 56 }, z: 0 },
  dock: { position: { wx: DOCK.wx + 40, wy: DOCK.wy + DOCK_PLANKS.bottom - 4 }, z: 0 },
  "tree house": { position: ladderFoot, z: 0 },
  meadow: { position: { wx: 280, wy: MEADOW.bottom + 40 }, z: 0 },
} as const;

type Paint = { tx: number; ty: number; terrain: number };

function rect(tx0: number, ty0: number, tx1: number, ty1: number, terrain: number): Paint[] {
  const out: Paint[] = [];
  for (let ty = ty0; ty <= ty1; ty++)
    for (let tx = tx0; tx <= tx1; tx++) out.push({ tx, ty, terrain });
  return out;
}
function ellipse(cx: number, cy: number, rx: number, ry: number, terrain: number): Paint[] {
  const out: Paint[] = [];
  for (let ty = Math.floor(cy - ry); ty <= Math.ceil(cy + ry); ty++)
    for (let tx = Math.floor(cx - rx); tx <= Math.ceil(cx + rx); tx++)
      if (((tx + 0.5 - cx) / rx) ** 2 + ((ty + 0.5 - cy) / ry) ** 2 <= 1)
        out.push({ tx, ty, terrain });
  return out;
}

/** Later entries paint over earlier ones. */
export function parkTerrain(): Paint[] {
  const trail = TerrainId.DirtWarm;
  const dock = DOCK.wy + DOCK_PLANKS.top;
  return [
    // Campground clearing and pond shore.
    ...ellipse(CAMP.wx / 16, CAMP.wy / 16, 7, 6, TerrainId.DirtLight),
    ...ellipse(POND.tx, POND.ty, POND.rx + 1.5, POND.ry + 1.5, TerrainId.Sand),
    // Trails: entrance north to the crossroads, then west, east and north.
    ...rect(-1, 4, 0, 27, trail),
    ...rect(-20, 4, -1, 5, trail),
    ...rect(1, 4, 15, 5, trail),
    ...rect(-1, -12, 0, 3, trail),
    ...rect(-18, -4, -1, -3, trail),
    ...rect(1, -12, 18, -11, trail),
    // Pond, then the sand jetty the dock planks rest on.
    ...ellipse(POND.tx, POND.ty, POND.rx, POND.ry, TerrainId.ShallowWater),
    ...ellipse(POND.tx, POND.ty, POND.rx - 2.5, POND.ry - 2, TerrainId.DeepWater),
    ...rect(
      (DOCK.wx - DOCK_PLANKS.width / 2) / 16,
      dock / 16,
      (DOCK.wx + DOCK_PLANKS.width / 2) / 16 - 1,
      (DOCK.wy + DOCK_PLANKS.bottom) / 16 - 1,
      TerrainId.Sand,
    ),
  ];
}

function campground() {
  const { wx, wy } = CAMP;
  const at = (kind: ParkPiece, dx: number, dy: number) => parkProp(kind, wx + dx, wy + dy);
  return [
    at("tentBlue", -120, -64),
    at("tentGreen", -24, -72),
    at("tentTan", 72, -64),
    at("logLong", 0, -26),
    at("logLong", 0, 32),
    at("logShort", -44, 4),
    at("logShort", 44, 4),
    at("cookingPot", 64, 12),
    at("lantern", -150, -54),
    at("backpack", -86, -58),
    at("sleepingBag", 104, -50),
  ];
}

function meadowFence() {
  const { left, top, right, bottom } = MEADOW;
  const across = (right - left) / 16,
    down = (bottom - top) / 16 - 1;
  return [
    fenceRun("north", left, top, across),
    fenceRun("west", left + 8, top, down),
    fenceRun("east", right - 8, top, down),
    fenceRun("south", left, bottom, across),
  ];
}

const OAKS = [
  [-100, -150],
  [120, -112],
  [-560, 260],
  [560, 300],
  [-300, 330],
  [220, 330],
  [580, -120],
  [-590, -210],
  [-150, 250],
] as const;

function wildlife(): Entity[] {
  const deer = [createDeer(220, -320), createDeer(340, -280)];
  for (const d of deer) if (d.deer) d.deer.radius = 64;
  const perch = required(robinTreePerches([createProp("prop-oak-tree", 120, -112)])[0]);
  const robin = createRobin(perch.wx, perch.wy);
  robin.wz = perch.z;
  if (robin.robin) robin.robin.state = "perch";
  return [
    ...deer,
    createRabbit(180, -250),
    createRabbit(390, -360),
    createRabbit(300, -240),
    createMallard(430, 40),
    createMallard(470, 96),
    createFrog(470, 148),
    createFrog(290, 12),
    robin,
  ];
}

export function outskirtsParkRecipe(): ScenarioRecipe {
  const start = PARK_STARTS.entrance.position;
  const { left, top, right, bottom } = PARK_BOUNDS;
  return {
    version: 1,
    id: "outskirts-park-v1",
    generation: FLAT_SCENARIO,
    player: { ...createPlayer(start.wx, start.wy), wz: 0 },
    terrain: parkTerrain(),
    props: [
      parkProp("campSign", 0, 400),
      parkProp("signpost", 32, 56),
      parkProp("dock", DOCK.wx, DOCK.wy),
      parkProp("rock", 230, 0),
      parkProp("rock", 500, 150),
      parkProp("rock", 470, -24),
      treeHouseProp(PARK_TREE_HOUSE.wx, PARK_TREE_HOUSE.wy),
      ...campground(),
      ...meadowFence(),
      ...[-440, 20, 480].map((wx) => required(forestRowProp(forestRowType(1, 3), wx, -440))),
      ...scenarioWalls(left, top, right, bottom),
    ],
    nativeProps: [
      ...OAKS.map(([wx, wy]) => ({ type: "prop-oak-tree", wx, wy })),
      { type: "prop-picnic-table", wx: -96, wy: 160 },
      { type: "prop-picnic-table", wx: 112, wy: 160 },
      { type: "prop-picnic-table", wx: CAMP.wx, wy: CAMP.wy + 104 },
      { type: "prop-bench", wx: 300, wy: 176 },
    ],
    actors: [createCampfire(CAMP.wx, CAMP.wy + 4), ...wildlife()],
  };
}
