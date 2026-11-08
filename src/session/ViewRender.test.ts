import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { Camera } from "../rendering/Camera.js";
import { SceneFrame } from "../rendering/SceneFrame.js";
import { RecordingBackend } from "../rendering/testing/RecordingBackend.js";
import { worldGeometryRecipe } from "../scenarios/WorldGeometryRecipe.js";
import { World } from "../world/World.js";
import { drawViewScene, drawViewTerrain } from "./ViewRender.js";

const props = worldGeometryRecipe().props;
const player = createPlayer(80, -80); // under the deck: its slab fades
const camera = new Camera();
camera.setViewport(960, 640);
const scene = {
  world: new World(),
  props,
  entities: [player],
  collectObserver: player,
  surfaceObserver: player,
};
const options = {
  alpha: 1,
  particles: [],
  grass: false,
  visibility: "auto" as const,
  presentationTime: 3,
  fadeSeconds: 10,
};

it("presents a view's slabs with its own fades on the device's shared frame", () => {
  const backend = new RecordingBackend(new Map());
  const frame = new SceneFrame();
  const fades = new Map<string, { opacity: number; time: number }>();
  drawViewScene(backend, camera, frame, fades, scene, options);
  expect([...fades.keys()]).toEqual(["deck"]);
  expect([frame.presentationTime, frame.fadeSeconds]).toEqual([3, 10]);
  expect(backend.passes.some((p) => p.kind === "overlay" && p.cacheKey === "deck")).toBe(true);
  expect(frame.items).toEqual([]); // released after drawing
});

it("lets a lab present its own room and still releases the frame when that throws", () => {
  const backend = new RecordingBackend(new Map());
  const frame = new SceneFrame();
  let presented = 0;
  drawViewScene(backend, camera, frame, new Map(), scene, {
    ...options,
    present: (items) => {
      presented = items.length;
    },
  });
  expect(presented).toBeGreaterThan(0);
  expect(backend.passes.filter((p) => p.kind === "scene")).toEqual([]);
  expect(() =>
    drawViewScene(backend, camera, frame, new Map(), scene, {
      ...options,
      present: () => {
        throw Error("room lost");
      },
    }),
  ).toThrow("room lost");
  expect(frame.items).toEqual([]);
});

it("clears with the view's background and skips terrain indoors", () => {
  const backend = new RecordingBackend(new Map());
  drawViewTerrain(backend, camera, undefined, {
    background: "#123456",
    pacing: "throughput",
    prepared: false,
  });
  expect(backend.passes).toEqual([{ kind: "clear", color: "#123456" }]);
});
