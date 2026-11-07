import RAPIER from "@dimforge/rapier3d-compat";
import type { Entity } from "../entities/Entity.js";
import { TOW, towAnchors } from "../traffic/Towing.js";
import { TRANSPORTER } from "../traffic/Transporter.js";
import { PHYSICS_PIXELS_PER_METRE as SCALE } from "./PhysicsDefaults.js";
import type { MotionIntent } from "./PhysicsState.js";

interface CoupledBody {
  entity: Entity;
  body: RAPIER.RigidBody;
  halfY: number;
}
interface Coupling {
  kind: "tow" | "carry";
  load: number;
  joint: RAPIER.ImpulseJoint;
}
const local = (b: CoupledBody, x: number, y: number, z: number) => ({
  x: x / SCALE,
  y: z / SCALE - b.halfY,
  z: y / SCALE,
});
const identity = { x: 0, y: 0, z: 0, w: 1 };

/** Replicated tow/carry links become joints in this same world. A tow truck's
 * cradle holds the car's front axle with a spherical joint; the car coasts on
 * its rear wheels. A transporter holds a secured car at the deck's load point
 * with a fixed joint. Authority and replay build identical joints from the
 * same replicated fields; joints carry no state beyond their two bodies. */
export class VehicleCouplings {
  private readonly couplings = new Map<number, Coupling>();
  private readonly loads = new Map<number, Coupling>();

  sync(world: RAPIER.World, bodies: ReadonlyMap<number, CoupledBody>) {
    for (const [lead, c] of this.couplings) {
      const truck = bodies.get(lead)?.entity;
      const wanted = c.kind === "tow" ? truck?.towTargetId : truck?.transportLoadId;
      if (wanted !== c.load || !bodies.has(c.load)) this.release(world, lead);
    }
    for (const [id, truck] of bodies) {
      const kind = truck.entity.towTargetId !== undefined ? "tow" : "carry";
      const load = truck.entity.towTargetId ?? truck.entity.transportLoadId;
      const car = load === undefined ? undefined : bodies.get(load);
      if (!car || this.couplings.has(id)) continue;
      const joint = world.createImpulseJoint(
        kind === "tow" ? this.tow(truck, car) : this.carry(truck, car),
        truck.body,
        car.body,
        true,
      );
      // The coupled pair must not push itself apart at the cradle or deck.
      joint.setContactsEnabled(false);
      const coupling = { kind, load: car.entity.id, joint } as const;
      this.couplings.set(id, coupling);
      this.loads.set(car.entity.id, coupling);
    }
  }
  private tow(truck: CoupledBody, car: CoupledBody) {
    const a = towAnchors(car.entity);
    return RAPIER.JointData.spherical(
      local(truck, a.truck.x, a.truck.y, a.truck.z),
      local(car, a.car.x, a.car.y, a.car.z),
    );
  }
  private carry(truck: CoupledBody, car: CoupledBody) {
    return RAPIER.JointData.fixed(
      local(truck, TRANSPORTER.loadX, 0, TRANSPORTER.height),
      identity,
      local(car, 0, 0, 0),
      identity,
    );
  }
  /** Before a body leaves the world, drop any coupling that references it. */
  remove(world: RAPIER.World, id: number) {
    this.release(world, id);
    const load = this.loads.get(id);
    if (load) for (const [lead, c] of this.couplings) if (c === load) this.release(world, lead);
  }
  private release(world: RAPIER.World, lead: number) {
    const c = this.couplings.get(lead);
    if (!c) return;
    if (c.joint.isValid()) world.removeImpulseJoint(c.joint, true);
    this.couplings.delete(lead);
    this.loads.delete(c.load);
  }
  clear() {
    this.couplings.clear();
    this.loads.clear();
  }
  /** Coupled pairs, for solved-contact dependency closure in local snapshots. */
  *pairs(): Iterable<readonly [number, number]> {
    for (const [lead, c] of this.couplings) yield [lead, c.load];
  }
  /** A secured car is carried by its joint; its own wheels do not act. */
  carried(id: number) {
    return this.loads.get(id)?.kind === "carry";
  }
  /** A towed car rolls freely on its rear axle. */
  towed(id: number) {
    return this.loads.get(id)?.kind === "tow";
  }

  /** Drive locks shared by authority and replay: a deployed ramp or a pending
   * coupling holds the lead vehicle; a jackknifed tow cannot reverse further. */
  driveIntent(
    entity: Entity,
    heading: number,
    input: MotionIntent,
    bodies: ReadonlyMap<number, { state: { heading: number } }>,
  ): MotionIntent {
    const pending = entity.vehicleLink?.lead && !this.couplings.has(entity.id);
    if (entity.vehicleRamp === 1 || pending) return { ...input, driveSpeed: 0, steering: 0 };
    const tow = this.couplings.get(entity.id);
    const car = tow?.kind === "tow" ? bodies.get(tow.load) : undefined;
    if (car && (input.driveSpeed ?? 0) < 0) {
      const bend = Math.abs(
        Math.atan2(Math.sin(heading - car.state.heading), Math.cos(heading - car.state.heading)),
      );
      if (bend >= TOW.maxAngle) return { ...input, driveSpeed: 0 };
    }
    return input;
  }
}
