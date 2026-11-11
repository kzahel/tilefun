import { LabView } from "../client/LabView.js";
import {
  DRIVING_IDLE,
  DRIVING_INPUT,
  DRIVING_WARMUP_TICKS,
  type DrivingFixture,
  drivingBenchRecipe,
} from "../scenarios/DrivingBenchRecipe.js";
import { fixedCamera } from "../session/View.js";
import { required } from "../shared/required.js";

const params = new URLSearchParams(location.search);
const fixture = params.get("fixture") as DrivingFixture;
const recipe = drivingBenchRecipe(fixture);
const zoom = Number(params.get("zoom") ?? (fixture === "jam" ? "0.25" : "1"));
if (!Number.isFinite(zoom) || zoom < 0.1 || zoom > 2) throw Error("Invalid zoom");
const terrainPacing = params.get("pacing") ?? "responsive";
if (terrainPacing !== "responsive" && terrainPacing !== "throughput")
  throw Error("Invalid terrain pacing");
const canvas = required(document.querySelector<HTMLCanvasElement>("#driving-bench"));
let paused = true,
  driving = false,
  failure: unknown;
const lab = new LabView(canvas, recipe, {
  width: innerWidth,
  height: innerHeight,
  terrain: true,
  ...(fixture === "jam" ? { camera: fixedCamera({ wx: 0, wy: 0 }) } : {}),
  input: () => (driving ? DRIVING_INPUT : DRIVING_IDLE),
  settings: () => ({ paused, zoom, terrainPacing }),
  onError: (error) => {
    failure = error;
  },
});
window.addEventListener("pagehide", () => lab.dispose(), { once: true });

function state() {
  if (failure) throw failure;
  const replica = lab.client.replica;
  const car = required(replica.serverEntities.find((e) => e.id === lab.client.handles.car));
  return {
    tick: replica.serverTick,
    x: car.position.wx,
    y: car.position.wy,
    speed: Math.hypot(car.velocity?.vx ?? 0, car.velocity?.vy ?? 0),
    seated: replica.serverPlayerEntity.parentId === car.id,
    vehicles: replica.serverEntities.filter((e) => e.type.startsWith("vehicle-v1:")).length,
    // Keep named poses in fixture order; ids/UUIDs are not workload identities.
    poses: Object.entries(lab.client.handles).map(([name, id]) => {
      const e = required(replica.serverEntities.find((e) => e.id === id));
      return {
        name,
        x: e.position.wx,
        y: e.position.wy,
        z: e.wz ?? 0,
        speed: Math.hypot(e.velocity?.vx ?? 0, e.velocity?.vy ?? 0),
      };
    }),
  };
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
async function pause() {
  paused = true;
  lab.client.setRunning(false);
  while (lab.client.busy) {
    if (failure) throw failure;
    await wait(5);
  }
  lab.client.update();
}

async function calibrate() {
  const idleFrames: number[] = [];
  let previous = await new Promise<number>(requestAnimationFrame);
  for (let i = 0; i < 60; i++) {
    const now = await new Promise<number>(requestAnimationFrame);
    idleFrames.push(now - previous);
    previous = now;
  }
  return idleFrames;
}

async function run(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 2 || seconds > 60) throw Error("Invalid duration");
  const start = state();
  const physicsBefore = await lab.client.samplePhysicsDiagnostics(true);
  lab.samplePerformance(true);
  const frames: number[] = [],
    checkpoints = [start],
    slowFrames: { atMs: number; endMs: number; frameMs: number }[] = [];
  let distance = 0,
    maxLateral = 0,
    lastX = start.x,
    lastY = start.y;
  let last = await new Promise<number>(requestAnimationFrame);
  const began = last;
  performance.mark("tilefun.driving.start", { startTime: began });
  driving = true;
  paused = false;
  while (last - began < seconds * 1000) {
    const now = await new Promise<number>(requestAnimationFrame);
    if (failure) throw failure;
    const ms = now - last;
    frames.push(ms);
    if (ms > 25) slowFrames.push({ atMs: now - began, endMs: now, frameMs: ms });
    const replica = lab.client.replica;
    const car = required(replica.serverEntities.find((e) => e.id === lab.client.handles.car));
    distance += Math.hypot(car.position.wx - lastX, car.position.wy - lastY);
    lastX = car.position.wx;
    lastY = car.position.wy;
    maxLateral = Math.max(maxLateral, Math.abs(lastY - start.y));
    if (now - began >= checkpoints.length * 1000) checkpoints.push(state());
    last = now;
  }
  performance.mark("tilefun.driving.end", { startTime: last });
  const timings = lab.samplePerformance();
  // Pause acknowledges the authority and applies its final snapshot. Cadence
  // ends above; the fence/diagnostic round trip is never timed as a display frame.
  await pause();
  const end = state();
  driving = false;
  const physics = await lab.client.samplePhysicsDiagnostics();
  return {
    start,
    end,
    checkpoints,
    distance,
    maxLateral,
    frames,
    slowFrames,
    elapsedMs: last - began,
    pageClock: { startMs: began, endMs: last, timeOriginMs: globalThis.performance.timeOrigin },
    performance: timings,
    physics,
    physicsBefore,
    presentation: lab.getDiagnostics(),
  };
}

await lab.ready;
await pause();
await lab.command({ kind: "enter-vehicle", entityId: required(lab.client.handles.car) });
for (let i = 0; i < DRIVING_WARMUP_TICKS; i++) await lab.client.step(DRIVING_IDLE);
// Warm meshes and the initial terrain without moving the car. Each CLI cell
// uses a new page/Worker: caches never carry across trials or zooms.
await wait(1500);
Object.assign(window, {
  __drivingBench: {
    measurementVersion: "idle-cadence-and-poses-v2",
    recipe,
    state,
    run,
    calibrate,
    diagnostics: () => lab.getDiagnostics(),
  },
});
canvas.dataset.ready = "true";
