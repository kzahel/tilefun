import RAPIER from "@dimforge/rapier3d-compat";
import {
  bridgeFixture,
  bridgeSections,
  type PhysicsStart,
  PLAYER_FOOT_OFFSET,
  PLAYER_HALF_HEIGHT,
  PLAYER_RADIUS,
  physicsStart,
  slabVertices,
} from "./BridgeFixture.js";
import { POSE_STRIDE } from "./PhysicsProtocol.js";

let initialization: Promise<void> | undefined;
export const initRapier = () => (initialization ??= RAPIER.init());
export const PHYSICS_DT = 1 / 60;
export const PHYSICS_WALK_SPEED = 4.5;
const CHARACTER_SKIN = 0.015;
export const PREDICTION_RADIUS = 24;
export interface PhysicsMotorState {
  tick: number;
  epoch: number;
  x: number;
  y: number;
  z: number;
  verticalSpeed: number;
  jumpHeld: boolean;
  grounded: boolean;
  supportY: number | null;
}
export interface PhysicsInput {
  x: number;
  z: number;
  jump: boolean;
}
export interface PhysicsDiagnostics {
  realmTickMs?: number;
  publishMs?: number;
  tick: number;
  stepMs: number;
  colliders: number;
  bodies: number;
  sleeping: number;
  grounded: boolean;
  feetY: number;
  sections: number;
  playerX: number;
  playerZ: number;
}

export interface FullPhysicsState {
  bytes: Uint8Array;
  sections: number;
  motors: PhysicsMotorState[];
  players: { body: number; collider: number }[];
  platform: number;
  loose: [number, number][];
  nextId: number;
}
interface Character {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
  motor: PhysicsMotorState;
}

/** Experimental shared backend: no renderer, DOM, messaging or game-feature checks. */
export class RapierWorld {
  world = new RAPIER.World({ x: 0, y: -18, z: 0 });
  readonly shapes;
  player: RAPIER.RigidBody;
  platform: RAPIER.RigidBody;
  private playerCollider: RAPIER.Collider;
  private controller: RAPIER.KinematicCharacterController;
  private readonly loose = new Map<number, RAPIER.RigidBody>();
  private guest: Character | undefined;
  private nextId = 2;
  private verticalSpeed = 0;
  private jumpHeld = false;
  private grounded = false;
  private ticks = 0;
  private platformY = 0.1;
  private lastStepMs = 0;
  private epoch = 0;
  private proxyAge = 0;
  private supportY: number | null = null;
  omittedProxies = 0;
  private readonly center: { x: number; z: number };
  readonly sections: number;

  constructor(
    sections = 8,
    initialObjects = 8,
    readonly prediction = false,
    center = { x: -11, z: 0 },
  ) {
    this.center = center;
    this.sections = bridgeSections(sections);
    this.shapes = bridgeFixture(this.sections);
    this.world.timestep = PHYSICS_DT;
    if (prediction) this.world.gravity = { x: 0, y: 0, z: 0 };
    for (const shape of this.shapes) {
      if (
        prediction &&
        shape.id !== "ground" &&
        (Math.abs(shape.x - center.x) > PREDICTION_RADIUS + shape.width / 2 ||
          Math.abs(shape.z - center.z) > PREDICTION_RADIUS + shape.depth / 2)
      )
        continue;
      const collider = RAPIER.ColliderDesc.convexHull(slabVertices(shape));
      if (!collider) throw Error(`Invalid physics slab: ${shape.id}`);
      this.world.createCollider(
        collider.setTranslation(shape.x, shape.y, shape.z).setFriction(0.8),
      );
    }
    const start = physicsStart(this.sections, "ramp");
    this.player = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x, start.y, start.z),
    );
    this.playerCollider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(PLAYER_HALF_HEIGHT, PLAYER_RADIUS),
      this.player,
    );
    this.platform = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicVelocityBased().setTranslation(-3, this.platformY, 6.5),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(1.5, 0.1, 1.5).setFriction(1),
      this.platform,
    );
    this.controller = this.createController();
    // Establish collider query structures before the first movement query.
    this.world.step();
    this.spawn(initialObjects);
  }

  teleport(start: PhysicsStart): void {
    const p = physicsStart(this.sections, start);
    if (start === "platform") p.y = this.platform.translation().y + 0.1 + PLAYER_FOOT_OFFSET + 0.06;
    this.player.setTranslation(p, true);
    this.player.setNextKinematicTranslation(p);
    this.verticalSpeed = 0;
    this.grounded = false;
    this.jumpHeld = false;
    this.supportY = null;
    this.epoch++;
    this.world.propagateModifiedBodyPositionsToColliders();
  }

  spawn(count: number): void {
    const origin = this.player.translation();
    const amount = Math.max(0, Math.min(count, 512 - this.loose.size));
    for (let i = 0; i < amount; i++) {
      const id = this.nextId++;
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(
            origin.x + 2 + (i % 5) * 0.8,
            origin.y + 2 + Math.floor(i / 25) * 0.7,
            origin.z - 1.2 + (Math.floor(i / 5) % 5) * 0.6,
          )
          .setCcdEnabled(true),
      );
      this.world.createCollider(
        (id % 2 ? RAPIER.ColliderDesc.ball(0.28) : RAPIER.ColliderDesc.cuboid(0.28, 0.28, 0.28))
          .setRestitution(0.35)
          .setFriction(0.7),
        body,
      );
      this.loose.set(id, body);
    }
  }

  step(input: PhysicsInput, guestInput: PhysicsInput = { x: 0, z: 0, jump: false }): void {
    const began = performance.now();
    this.ticks++;
    this.platformY = 0.1 + (1 - Math.cos(this.ticks * PHYSICS_DT * 0.8)) * 1.25;
    this.platform.setLinvel(
      { x: 0, y: (this.platformY - this.platform.translation().y) / PHYSICS_DT, z: 0 },
      true,
    );
    const state = this.motor();
    const playerMove = this.moveCharacter(this.playerCollider, this.controller, input, state);
    const guestMove = this.guest
      ? this.moveCharacter(this.guest.collider, this.guest.controller, guestInput, this.guest.motor)
      : null;
    if (this.guest && guestMove) {
      this.resolveCharacterContact(
        playerMove.movement,
        guestMove.movement,
        state,
        this.guest.motor,
      );
      this.commitCharacterMovement(this.guest.body, guestMove.movement);
    }
    this.verticalSpeed = state.verticalSpeed;
    this.jumpHeld = state.jumpHeld;
    this.grounded = state.grounded;
    this.commitCharacterMovement(this.player, playerMove.movement);
    this.world.step();
    this.supportY =
      playerMove.support && !playerMove.support.isFixed()
        ? playerMove.support.translation().y
        : null;
    if (this.guest)
      this.guest.motor.supportY =
        guestMove?.support && !guestMove.support.isFixed()
          ? guestMove.support.translation().y
          : null;
    this.proxyAge += PHYSICS_DT;
    if (this.prediction && this.proxyAge > 0.1)
      for (const body of this.loose.values()) body.setLinvel({ x: 0, y: 0, z: 0 }, false);
    if (this.player.translation().y < -8) this.teleport("ramp");
    for (const [id, body] of this.loose) {
      if (body.translation().y < -10) {
        this.world.removeRigidBody(body);
        this.loose.delete(id);
      }
    }
    this.lastStepMs = performance.now() - began;
  }

  private createController() {
    const controller = this.world.createCharacterController(CHARACTER_SKIN);
    controller.enableAutostep(0.22, 0.25, false);
    controller.enableSnapToGround(0.25);
    controller.setMaxSlopeClimbAngle(Math.PI / 4);
    controller.setMinSlopeSlideAngle(Math.PI / 3);
    controller.setApplyImpulsesToDynamicBodies(true);
    controller.setCharacterMass(30);
    return controller;
  }

  private queryCharacterMovement(
    controller: RAPIER.KinematicCharacterController,
    collider: RAPIER.Collider,
    movement: RAPIER.Vector,
  ) {
    // Rapier's KCC inherits both normal and tangential kinematic velocity.
    // That is correct for prescribed lifts, but feeds motion between motors.
    // Actor/actor contacts use the relative sweep below, on the same colliders.
    controller.computeColliderMovement(
      collider,
      movement,
      undefined,
      undefined,
      this.guest
        ? (other) =>
            other.handle !== this.playerCollider.handle &&
            other.handle !== this.guest?.collider.handle
        : undefined,
    );
  }

  private resolveCharacterContact(
    first: RAPIER.Vector,
    second: RAPIER.Vector,
    firstState: PhysicsMotorState,
    secondState: PhysicsMotorState,
  ) {
    if (!this.guest) return;
    const hit = this.playerCollider.castCollider(
      first,
      this.guest.collider,
      second,
      CHARACTER_SKIN,
      1,
      false,
    );
    if (!hit) return;
    // Collider-cast normals are local. Controlled capsules stay unrotated.
    const n = hit.normal1;
    const firstIn = first.x * n.x + first.y * n.y + first.z * n.z;
    const secondIn = -(second.x * n.x + second.y * n.y + second.z * n.z);
    const closing = firstIn + secondIn;
    // Casts can report t=0 at the resting skin even while moving apart/tangent.
    if (closing <= 1e-6) return;
    const inward = Math.max(0, firstIn) + Math.max(0, secondIn);
    const remove = closing * (1 - Math.max(0, hit.time_of_impact - 0.001));
    // Equal controlled masses share a horizontal contact response: walking
    // into an idle player moves both, opposing input balances. Vertical contact
    // still blocks the falling/jumping motor instead of pushing a support down.
    // Resolve THIS tick's proposals; solved velocities never become next input.
    const horizontalContact = Math.abs(n.y) < 0.5;
    const firstShare = remove * (horizontalContact ? 0.5 : Math.max(0, firstIn) / inward);
    const secondShare = remove - firstShare;
    const horizontalBudgets = [first, second].map((move) =>
      Math.max(PHYSICS_WALK_SPEED * PHYSICS_DT, Math.hypot(move.x, move.z)),
    );

    first.x -= n.x * firstShare;
    first.y -= n.y * firstShare;
    first.z -= n.z * firstShare;
    second.x += n.x * secondShare;
    second.y += n.y * secondShare;
    second.z += n.z * secondShare;
    // A sideways push plus full tangential walking can exceed walking speed.
    // Bound the combined horizontal proposal, preserving any existing support
    // carry in the original budget. This is per-tick motion, not stored inertia.
    for (const [index, move] of [first, second].entries()) {
      const speed = Math.hypot(move.x, move.z);
      const budget = horizontalBudgets[index] ?? 0;
      if (speed > budget) {
        move.x *= budget / speed;
        move.z *= budget / speed;
      }
    }
    if (n.y < -0.5 && firstIn > 0) {
      firstState.grounded = true;
      firstState.verticalSpeed = 0;
    }
    if (n.y > 0.5 && secondIn > 0) {
      secondState.grounded = true;
      secondState.verticalSpeed = 0;
    }
    if (n.y > 0.5 && firstState.verticalSpeed > 0) firstState.verticalSpeed = 0;
    if (n.y < -0.5 && secondState.verticalSpeed > 0) secondState.verticalSpeed = 0;

    // Sliding along an actor can point into adjacent terrain. Recheck the
    // environment without applying a second set of dynamic-body impulses.
    for (const [controller, collider, move] of [
      [this.controller, this.playerCollider, first],
      [this.guest.controller, this.guest.collider, second],
    ] as const) {
      controller.setApplyImpulsesToDynamicBodies(false);
      this.queryCharacterMovement(controller, collider, move);
      Object.assign(move, controller.computedMovement());
      controller.setApplyImpulsesToDynamicBodies(true);
    }
    // A terrain clip can change relative motion again. This final conservative
    // guard only shortens both paths, so neither wall nor actor is crossed.
    const guard = this.playerCollider.castCollider(
      first,
      this.guest.collider,
      second,
      CHARACTER_SKIN / 2,
      1,
      false,
    );
    if (guard) {
      const closing =
        (first.x - second.x) * guard.normal1.x +
        (first.y - second.y) * guard.normal1.y +
        (first.z - second.z) * guard.normal1.z;
      if (closing > 1e-6) {
        const fraction = Math.max(0, guard.time_of_impact - 0.001);
        for (const move of [first, second]) {
          move.x *= fraction;
          move.y *= fraction;
          move.z *= fraction;
        }
      }
    }
  }

  private commitCharacterMovement(body: RAPIER.RigidBody, move: RAPIER.Vector) {
    const p = body.translation();
    body.setNextKinematicTranslation({ x: p.x + move.x, y: p.y + move.y, z: p.z + move.z });
  }

  private moveCharacter(
    collider: RAPIER.Collider,
    controller: RAPIER.KinematicCharacterController,
    input: PhysicsInput,
    state: PhysicsMotorState,
  ) {
    const jump = input.jump && !state.jumpHeld && state.grounded;
    state.jumpHeld = input.jump;
    if (jump) state.verticalSpeed = 6;
    else if (state.grounded) state.verticalSpeed = -0.5;
    state.verticalSpeed = Math.max(-25, state.verticalSpeed - 18 * PHYSICS_DT);
    const rawX = Number.isFinite(input.x) ? input.x : 0;
    const rawZ = Number.isFinite(input.z) ? input.z : 0;
    const magnitude = Math.max(1, Math.hypot(rawX, rawZ));
    const x = rawX / magnitude,
      z = rawZ / magnitude;
    // Publish prescribed support velocities before querying character motion;
    // Rapier resolves moving contacts without a platform-specific carry rule.
    this.queryCharacterMovement(controller, collider, {
      x: x * PHYSICS_WALK_SPEED * PHYSICS_DT,
      y: state.verticalSpeed * PHYSICS_DT,
      z: z * PHYSICS_WALK_SPEED * PHYSICS_DT,
    });
    const move = controller.computedMovement();
    state.grounded = controller.computedGrounded();
    let support: RAPIER.RigidBody | null = null;
    if (state.grounded)
      for (let i = 0; i < controller.numComputedCollisions(); i++) {
        const contact = controller.computedCollision(i);
        if (contact && contact.normal1.y > 0.5) support = contact.collider?.parent() ?? null;
      }
    if (state.grounded && state.verticalSpeed < 0) state.verticalSpeed = 0;
    if (move.y < state.verticalSpeed * PHYSICS_DT - 0.001 && state.verticalSpeed > 0)
      state.verticalSpeed = 0;
    return { movement: move, support };
  }

  /** Reference scenes have two controlled capsules and fully dynamic loose bodies. */
  configurePair(
    positions: readonly { x: number; y: number; z: number }[],
    cube: { x: number; y: number; z: number } | null,
  ) {
    const first = positions[0],
      second = positions[1];
    if (!first || !second || this.guest)
      throw Error("Pair must be configured once with two positions");
    this.player.setTranslation(first, true);
    this.player.setNextKinematicTranslation(first);
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(second.x, second.y, second.z),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(PLAYER_HALF_HEIGHT, PLAYER_RADIUS),
      body,
    );
    this.guest = {
      body,
      collider,
      controller: this.createController(),
      motor: { ...this.motor(), ...second },
    };
    if (cube) {
      const loose = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(cube.x, cube.y, cube.z).setCcdEnabled(true),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.4, 0.4, 0.4).setFriction(0.7).setRestitution(0),
        loose,
      );
      this.loose.set(this.nextId++, loose);
    }
    this.world.propagateModifiedBodyPositionsToColliders();
  }

  motorFor(seat: number): PhysicsMotorState {
    if (seat === 0) return this.motor();
    if (!this.guest) throw Error("Guest is absent");
    return {
      ...this.guest.motor,
      ...this.guest.body.translation(),
      tick: this.ticks,
      epoch: this.epoch,
    };
  }

  /** Includes contacts/sleeping/velocities and stable handles, plus our JS motor state.
   * Character controllers are query helpers and must be recreated on the restored world. */
  snapshot(): FullPhysicsState {
    return {
      bytes: this.world.takeSnapshot(),
      sections: this.sections,
      motors: this.guest ? [this.motor(), this.motorFor(1)] : [this.motor()],
      players: [
        { body: this.player.handle, collider: this.playerCollider.handle },
        ...(this.guest
          ? [{ body: this.guest.body.handle, collider: this.guest.collider.handle }]
          : []),
      ],
      platform: this.platform.handle,
      loose: [...this.loose].map(([id, body]) => [id, body.handle]),
      nextId: this.nextId,
    };
  }

  restoreFull(state: FullPhysicsState): void {
    if (this.prediction || state.sections !== this.sections)
      throw Error("Full replay requires matching complete scene");
    const restored = RAPIER.World.restoreSnapshot(state.bytes);
    this.world.free();
    this.world = restored;
    const bindings = state.players.map((handles, i) => {
      const motor = state.motors[i];
      if (!motor) throw Error("Missing motor state");
      return {
        body: restored.getRigidBody(handles.body),
        collider: restored.getCollider(handles.collider),
        controller: this.createController(),
        motor: { ...motor },
      };
    });
    const first = bindings[0];
    if (!first) throw Error("Missing first player");
    this.player = first.body;
    this.playerCollider = first.collider;
    this.controller = first.controller;
    this.guest = bindings[1];
    this.platform = restored.getRigidBody(state.platform);
    this.platformY = this.platform.translation().y;
    this.loose.clear();
    for (const [id, handle] of state.loose) this.loose.set(id, restored.getRigidBody(handle));
    this.nextId = state.nextId;
    this.ticks = first.motor.tick;
    this.epoch = first.motor.epoch;
    this.verticalSpeed = first.motor.verticalSpeed;
    this.jumpHeld = first.motor.jumpHeld;
    this.grounded = first.motor.grounded;
    this.supportY = first.motor.supportY;
  }

  poses(): Float32Array {
    const data = new Float32Array((this.loose.size + 2 + Number(!!this.guest)) * POSE_STRIDE);
    let offset = 0;
    const append = (id: number, body: RAPIER.RigidBody) => {
      const p = body.translation(),
        q = body.rotation();
      const v = body.linvel(),
        a = body.angvel();
      data.set([id, p.x, p.y, p.z, q.x, q.y, q.z, q.w, v.x, v.y, v.z, a.x, a.y, a.z], offset);
      offset += POSE_STRIDE;
    };
    append(0, this.player);
    append(1, this.platform);
    if (this.guest) append(-1, this.guest.body);
    for (const [id, body] of this.loose) append(id, body);
    return data;
  }

  diagnostics(): PhysicsDiagnostics {
    let sleeping = 0;
    for (const body of this.loose.values()) if (body.isSleeping()) sleeping++;
    return {
      tick: this.ticks,
      stepMs: this.lastStepMs,
      colliders: this.world.colliders.len(),
      bodies: this.world.bodies.len(),
      sleeping,
      grounded: this.grounded,
      feetY: this.player.translation().y - PLAYER_FOOT_OFFSET,
      sections: this.sections,
      playerX: this.player.translation().x,
      playerZ: this.player.translation().z,
    };
  }

  motor(): PhysicsMotorState {
    const p = this.player.translation();
    return {
      tick: this.ticks,
      epoch: this.epoch,
      x: p.x,
      y: p.y,
      z: p.z,
      verticalSpeed: this.verticalSpeed,
      jumpHeld: this.jumpHeld,
      grounded: this.grounded,
      supportY: this.supportY,
    };
  }

  halfExtents(id: number) {
    const body = id === 1 ? this.platform : this.loose.get(id);
    if (!body) throw Error("Missing loose body");
    const collider = body.collider(0),
      half = collider.halfExtents();
    return half ?? { x: collider.radius(), y: collider.radius(), z: collider.radius() };
  }

  supportHeight(seat = 0): number {
    const body = seat === 0 ? this.player : this.guest?.body;
    const collider = seat === 0 ? this.playerCollider : this.guest?.collider;
    if (!body || !collider) throw Error("Missing controlled body");
    const p = body.translation();
    const origin = { x: p.x, y: p.y - PLAYER_FOOT_OFFSET + 0.05, z: p.z };
    const hit = this.world.castRay(
      new RAPIER.Ray(origin, { x: 0, y: -1, z: 0 }),
      100,
      true,
      undefined,
      undefined,
      collider,
      body,
    );
    return hit ? origin.y - hit.timeOfImpact : 0;
  }

  fence(): void {
    this.epoch++;
  }

  contains(motor: PhysicsMotorState): boolean {
    return (
      Math.abs(motor.x - this.center.x) < PREDICTION_RADIUS / 2 &&
      Math.abs(motor.z - this.center.z) < PREDICTION_RADIUS / 2
    );
  }

  /** Bounded local query world. Loose bodies are velocity proxies, not a second
   * authoritative rigid-body simulation; subsequent corrections remain visible. */
  restore(motor: PhysicsMotorState, poses: Float32Array): void {
    if (!this.prediction) throw Error("Only prediction worlds accept replica state");
    const retained = new Set<number>(),
      velocities = new Map<number, { x: number; y: number; z: number }>();
    this.player.setTranslation(motor, true);
    this.player.setNextKinematicTranslation(motor);
    this.player.setLinvel({ x: 0, y: 0, z: 0 }, false);
    this.omittedProxies = 0;
    for (let i = 0; i < poses.length; i += POSE_STRIDE) {
      const id = poses[i] ?? 0;
      if (id === 0) continue;
      const p = { x: poses[i + 1] ?? 0, y: poses[i + 2] ?? 0, z: poses[i + 3] ?? 0 };
      if (id > 1 && Math.hypot(p.x - motor.x, p.z - motor.z) > PREDICTION_RADIUS) continue;
      if (id > 1 && retained.size >= 129) {
        this.omittedProxies++;
        continue;
      }
      let body = id === 1 ? this.platform : this.loose.get(id);
      if (!body) {
        body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicVelocityBased());
        this.world.createCollider(
          id % 2 ? RAPIER.ColliderDesc.ball(0.28) : RAPIER.ColliderDesc.cuboid(0.28, 0.28, 0.28),
          body,
        );
        this.loose.set(id, body);
      }
      retained.add(id);
      body.setTranslation(p, true);
      body.setRotation(
        { x: poses[i + 4] ?? 0, y: poses[i + 5] ?? 0, z: poses[i + 6] ?? 0, w: poses[i + 7] ?? 1 },
        true,
      );
      body.setLinvel({ x: 0, y: 0, z: 0 }, false);
      body.setAngvel({ x: 0, y: 0, z: 0 }, false);
      if (id > 1)
        velocities.set(id, { x: poses[i + 8] ?? 0, y: poses[i + 9] ?? 0, z: poses[i + 10] ?? 0 });
    }
    for (const [id, body] of this.loose)
      if (!retained.has(id)) {
        this.world.removeRigidBody(body);
        this.loose.delete(id);
      }
    // Refresh broad-phase state without moving replica bodies or running gravity.
    this.world.propagateModifiedBodyPositionsToColliders();
    this.world.step();
    for (const [id, velocity] of velocities) this.loose.get(id)?.setLinvel(velocity, false);
    this.ticks = motor.tick;
    this.epoch = motor.epoch;
    this.verticalSpeed = motor.verticalSpeed;
    this.jumpHeld = motor.jumpHeld;
    this.grounded = motor.grounded;
    this.proxyAge = 0;
    this.supportY = motor.supportY;
  }

  dispose(): void {
    this.world.free();
  }
}
