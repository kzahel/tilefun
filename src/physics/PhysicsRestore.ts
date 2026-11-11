import { rotateBodyVector, yawRotation } from "./BodyRotation.js";
import { PHYSICS_PIXELS_PER_METRE as SCALE } from "./PhysicsDefaults.js";
import type { PhysicsBodyState } from "./PhysicsState.js";
import type { SceneBody } from "./SceneBody.js";

/** One scene's immediate Rapier setter arguments. Setters copy numbers into WASM;
 * these vectors never escape into entities, numerical snapshots or replay jobs. */
export class PhysicsRestore {
  private readonly center = { x: 0, y: 0, z: 0 };
  private readonly position = { x: 0, y: 0, z: 0 };
  private readonly linear = { x: 0, y: 0, z: 0 };
  private readonly angular = { x: 0, y: 0, z: 0 };
  private readonly rotation = { x: 0, y: 0, z: 0, w: 1 };

  body(entry: SceneBody, state: PhysicsBodyState, origin: { x: number; z: number }) {
    const rotation = state.rotation ?? yawRotation(state.heading),
      center = rotateBodyVector(rotation, 0, 0, entry.halfY, this.center);
    const p = this.position;
    p.x = state.x / SCALE + entry.offsetX + center.x - origin.x;
    p.y = state.z / SCALE + center.z;
    p.z = state.y / SCALE + entry.offsetY + center.y - origin.z;
    entry.body.setTranslation(p, true);
    const v = this.linear;
    v.x = state.vx / SCALE;
    v.y = state.vz / SCALE;
    v.z = state.vy / SCALE;
    entry.body.setLinvel(v, true);
    const q = this.rotation;
    q.x = -rotation[0];
    q.y = -rotation[2];
    q.z = -rotation[1];
    q.w = rotation[3];
    entry.body.setRotation(q, true);
    const a = this.angular;
    a.x = -(state.angularVelocity?.[0] ?? 0);
    a.y = -(state.angularVelocity?.[2] ?? 0);
    a.z = -(state.angularVelocity?.[1] ?? 0);
    entry.body.setAngvel(a, true);
    if (state.sleeping) entry.body.sleep();
    // Keep the numerical copy independent. Reusing this record costs more CPU
    // than a spread on V8; only the immediate setter arguments above are scratch.
    entry.state = { ...state };
    entry.rested = 0;
    entry.dormant = entry.centred = entry.unmoved = entry.held = false;
    entry.touching.length = 0;
    entry.bed?.publish(entry.entity, entry.state, entry.collider);
    const entity = entry.entity;
    entity.prevPosition = { wx: state.prevX, wy: state.prevY };
    entity.prevWz = state.prevZ;
    if (entry.kind === "vehicle") {
      entity.bodyRotation = state.rotation ?? rotation;
      entity.prevBodyRotation = state.prevRotation ?? rotation;
      entity.bodyAngularVelocity = state.angularVelocity ?? [0, 0, 0];
      entity.vehicleHeading = state.heading;
      entity.prevVehicleHeading = state.prevHeading;
    }
    entity.position.wx = state.x;
    entity.position.wy = state.y;
    entity.wz = state.z;
    entity.groundZ = state.groundZ;
    entity.jumpZ = Math.max(0, state.z - state.groundZ);
    entity.jumpInputState = state.jumpHeld ? 3 : 0;
    if (entity.velocity) {
      entity.velocity.vx = state.vx;
      entity.velocity.vy = state.vy;
    }
    if (state.grounded) delete entity.jumpVZ;
    else entity.jumpVZ = state.vz;
  }
}
