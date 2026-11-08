import type RAPIER from "@dimforge/rapier3d-compat";
import { afterEach, expect, it } from "vitest";
import { JUMP_GRAVITY } from "../config/constants.js";
import { Direction, type Entity } from "../entities/Entity.js";
import { required } from "../shared/required.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { SURFACE_GRIP, SURFACE_SPEED, vehicleHandling } from "../traffic/VehicleHandling.js";
import { DEFAULT_BOOST, vehiclePerformance } from "../traffic/VehiclePerformance.js";
import type { GroundMaterial } from "./GroundMaterial.js";
import { type PhysicsGeometry, PhysicsScene } from "./PhysicsScene.js";
import { VehicleChassis } from "./VehicleChassis.js";
import { angleDifference } from "./VehicleMotor.js";

const scenes: PhysicsScene[] = [];
afterEach(() => {
  for (const scene of scenes.splice(0)) scene.dispose();
});
/** Flat ground where every wheel reports `material`. */
function flat(material?: GroundMaterial): PhysicsGeometry {
  return {
    getCollision: () => 0,
    getHeight: () => 0,
    queryProps: () => [],
    geometryVersion: () => ({ identity: undefined, revision: 0 }),
    ...(material ? { groundMaterial: () => material } : {}),
  };
}
async function drive(
  model: string,
  material: GroundMaterial | undefined,
  ticks: number,
  input: (tick: number) => { driveSpeed: number; steering?: number },
  each?: (state: { vx: number; vy: number; heading: number }, tick: number) => void,
) {
  const scene = await PhysicsScene.create();
  scenes.push(scene);
  const car = createVehicle(model, 0, 0, Direction.Right);
  car.id = 1;
  const geometry = flat(material);
  for (let tick = 0; tick < ticks; tick++) {
    scene.synchronize([car]);
    scene.step(new Map([[1, { vx: 0, vy: 0, ...input(tick) }]]), geometry);
    each?.(required(scene.bodyState(1)), tick);
  }
  return car;
}
const speedOf = (car: Entity) => Math.hypot(car.velocity?.vx ?? 0, car.velocity?.vy ?? 0);

it("slows road cars in sand to their surface fraction, with off-road tires keeping more", async () => {
  for (const model of ["compact-1", "offroad-jeep"]) {
    const { speed } = vehiclePerformance(`vehicle-v1:${model}`);
    const sustained = SURFACE_SPEED[vehicleHandling(model).tires].sand;
    const car = await drive(model, "sand", 600, () => ({ driveSpeed: speed }));
    expect(speedOf(car) / speed).toBeCloseTo(sustained, 1);
  }
  // Pavement keeps full top speed (drag only on sand and water).
  const paved = await drive("compact-1", "paved", 300, () => ({ driveSpeed: 112 }));
  expect(speedOf(paved)).toBeGreaterThan(108);
  // Drag grows with speed: a launch in sand nears its sand top speed within half
  // a second rather than crawling (linear drag reached about two thirds).
  const launch = await drive("compact-1", "sand", 30, () => ({ driveSpeed: 112 }));
  expect(speedOf(launch)).toBeGreaterThan(0.85 * SURFACE_SPEED.road.sand * 112);
});

it("slides wider on dirt than pavement, and off-road tires hold dirt better", async () => {
  /** Mean lateral acceleration (world px/s²) over a held full-lock turn at boosted speed. */
  async function cornering(model: string, material: GroundMaterial) {
    const p = vehiclePerformance(`vehicle-v1:${model}`);
    let turned = 0,
      speed = 0,
      previous = 0;
    await drive(
      model,
      material,
      240,
      (tick) => ({
        driveSpeed: p.speed * (p.boost ?? DEFAULT_BOOST),
        steering: tick < 150 ? 0 : 1,
      }),
      (state, tick) => {
        if (tick >= 180) {
          turned += Math.abs(angleDifference(state.heading, previous));
          speed += Math.hypot(state.vx, state.vy) / 60;
        }
        previous = state.heading;
      },
    );
    return speed * turned;
  }
  const road = await cornering("rally-hatchback", "paved"),
    dirt = await cornering("race-coupe", "dirt"),
    paved = await cornering("race-coupe", "paved"),
    offroad = await cornering("rally-hatchback", "dirt");
  expect(dirt).toBeLessThan(paved * 0.75);
  expect(offroad).toBeGreaterThan(dirt * 1.4);
  // Nothing exceeds the 1.2 cornering ceiling the 216 rollover margin was tuned for.
  expect(Math.max(road, offroad, paved)).toBeLessThan(1.2 * JUMP_GRAVITY);
});

it("never grips above pavement for any tire and surface", () => {
  // The steering limit caps simulated demand, so check the table itself.
  for (const [tires, grips] of Object.entries(SURFACE_GRIP))
    for (const [surface, grip] of Object.entries(grips))
      expect(grip, `${tires} on ${surface}`).toBeLessThanOrEqual(1);
});

it("puts engine force on the front, rear or all axles by model", () => {
  /** Longitudinal drive impulse per wheel for one step from rest on flat pavement. */
  function driveImpulses(model: string) {
    const body = {
      isSleeping: () => false,
      wakeUp: () => {},
      rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }),
      translation: () => ({ x: 0, y: 0, z: 0 }),
      linvel: () => ({ x: 0, y: 0, z: 0 }),
      angvel: () => ({ x: 0, y: 0, z: 0 }),
      mass: () => 8,
    } as unknown as RAPIER.RigidBody;
    const chassis = new VehicleChassis(body, `vehicle-v1:${model}`, 40, 20, 16);
    // Every wheel compressed 0.15m into level ground.
    const impulses = chassis.prepare({ vx: 0, vy: 0, driveSpeed: 100 }, 0, (_o, _d, length) => ({
      distance: length - 0.37,
      normal: { x: 0, y: 1, z: 0 },
    }));
    const front = impulses.filter((i) => i.point.x > 0).map((i) => i.impulse.x),
      rear = impulses.filter((i) => i.point.x < 0).map((i) => i.impulse.x);
    return { front: Math.min(...front), rear: Math.min(...rear) };
  }
  const fwd = driveImpulses("compact-1"),
    rwd = driveImpulses("race-coupe"),
    awd = driveImpulses("offroad-jeep"),
    truck = driveImpulses("dump-truck");
  expect(fwd.front).toBeGreaterThan(0);
  expect(fwd.rear).toBeCloseTo(0, 6);
  expect(rwd.front).toBeCloseTo(0, 6);
  expect(rwd.rear).toBeGreaterThan(0);
  expect(awd.front).toBeGreaterThan(0);
  expect(awd.rear).toBeGreaterThan(0);
  // Six-wheel trucks drive their middle and rear axles, never the front.
  expect(truck.front).toBeCloseTo(0, 6);
  expect(truck.rear).toBeGreaterThan(0);
});
