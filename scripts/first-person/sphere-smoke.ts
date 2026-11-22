import { createConstructionCargo, WRECKING_BALL } from "../../src/entities/ConstructionCargo.js";
import { Direction, type Entity } from "../../src/entities/Entity.js";
import { createPlayer } from "../../src/entities/Player.js";
import { collectWorldSprites } from "../../src/rendering/collectScene.js";
import { NORTH_YAW } from "../../src/rendering/firstperson/FirstPersonCamera.js";
import {
  type FirstPersonFrame,
  FirstPersonView,
} from "../../src/rendering/firstperson/FirstPersonView.js";
import { GpuRenderResources } from "../../src/rendering/GpuRenderResources.js";
import { createView3dHost } from "../../src/rendering/GpuView3d.js";
import { yawOrientation } from "../../src/rendering/MeshPresentation.js";
import { SceneFrame } from "../../src/rendering/SceneFrame.js";
import type { SpriteItem } from "../../src/rendering/SceneItem.js";
import { required } from "../../src/shared/required.js";
import { createVehicle } from "../../src/traffic/Vehicle.js";
import { SPHERE_CAR, SPHERE_CHARACTER, SPHERE_RADIUS } from "./sphere-fixtures.js";

const world = { getChunkIfLoaded: () => undefined, getHeightAt: () => 0 };
const background = "#f7f6f2";
const scale = 3;
const eyeDistance = 52;
const modes = ["top-down image", "top-down mesh", "perspective"] as const;
type Mode = (typeof modes)[number];

function sphereActors() {
  const ball = createConstructionCargo(WRECKING_BALL, 0, 0);
  ball.bodyRotation = yawOrientation(Math.PI / 5);
  const car = createVehicle(SPHERE_CAR, 0, 0);
  car.bodyRotation = yawOrientation(Math.PI / 3);
  const character = createPlayer(0, 0);
  Object.assign(required(character.sprite), {
    sheetKey: SPHERE_CHARACTER,
    direction: Direction.Left,
    frameCol: 1,
  });
  return { ball, character, car };
}

function sphereSprite(entity: Entity, frame: SceneFrame): SpriteItem {
  const items = frame.begin(false);
  collectWorldSprites({
    world,
    entities: [entity],
    props: [],
    items,
    frame,
    alpha: 1,
    cull: { left: -100, right: 100, top: -100, bottom: 100 },
  });
  const sprite = required(items.find((item) => item.kind === "sprite"));
  frame.release();
  return sprite;
}

function measure(canvas: HTMLCanvasElement) {
  const { width, height } = canvas;
  const copy = document.createElement("canvas");
  copy.width = width;
  copy.height = height;
  const ctx = required(copy.getContext("2d"));
  ctx.drawImage(canvas, 0, 0);
  const rgba = ctx.getImageData(0, 0, width, height).data;
  let left = width,
    right = -1,
    top = height,
    bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = 4 * (y * width + x);
      if (rgba[p] === 247 && rgba[p + 1] === 246 && rgba[p + 2] === 242) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return {
    width: right - left + 1,
    height: bottom - top + 1,
    centerX: (left + right + 1) / 2,
    centerY: (top + bottom + 1) / 2,
  };
}

export async function runSphereSmoke() {
  const canvas = document.createElement("canvas");
  const resources = new GpuRenderResources(canvas);
  const scene = new FirstPersonView(new Map());
  const host = createView3dHost(
    resources.surface,
    resources.meshes,
    () => null,
    undefined,
    resources.bodyImage.bind(resources),
  );
  const frame = new SceneFrame();
  function draw(item: SpriteItem, mode: Mode) {
    const perspective = mode === "perspective";
    const view: FirstPersonFrame = {
      world,
      realm: null,
      props: [],
      sprites: [item],
      drawRadius: 300,
      background,
      shadows: false,
      eye: {
        x: 0,
        y: perspective ? eyeDistance : -SPHERE_RADIUS,
        z: SPHERE_RADIUS,
        yaw: NORTH_YAW,
        pitch: 0,
      },
      ...(!perspective && { topDown: { scale }, pixelBodies: mode === "top-down image" }),
    };
    resources.beginFrame();
    host.draw(undefined, (target) => scene.render(view, target));
  }
  try {
    const results = [];
    for (const [name, actor] of Object.entries(sphereActors())) {
      const item = sphereSprite(actor, frame);
      resources.resize(320, 208);
      // Wait for the registered GLBs to finish their ordinary load path.
      const deadline = performance.now() + 5000;
      while (performance.now() < deadline) {
        draw(item, "top-down image");
        if (scene.stats.cars === 1 || scene.stats.wildlifeMeshes === 1) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      for (const [width, height] of [
        [320, 208],
        [208, 320],
      ] as const) {
        resources.resize(width, height);
        for (const mode of modes) {
          if (name === "character" && mode === "top-down image") continue;
          draw(item, mode);
          const perspective = mode === "perspective";
          // These are the analytic screen diameters of a sphere aimed at the eye,
          // or at the centre of the oblique view at the fixed three-pixel scale.
          const diameter = perspective
            ? (height * SPHERE_RADIUS) /
              (Math.tan((35 * Math.PI) / 180) * Math.sqrt(eyeDistance ** 2 - SPHERE_RADIUS ** 2))
            : 2 * SPHERE_RADIUS * scale;
          results.push({
            name,
            mode,
            viewport: [width, height],
            measured: measure(canvas),
            expected: {
              width: diameter,
              height: perspective || name === "ball" ? diameter : diameter * Math.SQRT2,
            },
            bodyImages: scene.stats.bodyImages,
            rigidMeshes: scene.stats.cars - scene.stats.bodyImages,
            skinnedMeshes: scene.stats.wildlifeMeshes,
          });
        }
      }
    }
    return results;
  } finally {
    scene.dispose();
    resources.dispose();
  }
}
