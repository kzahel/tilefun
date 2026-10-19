import { BOAT_SEAT_Z, isBoat } from "../boats/Boat.js";
import {
  aabbOverlapsPropWalls,
  aabbOverlapsSolid,
  aabbsOverlap,
  getEntityAABB,
} from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { getSurfaceZ, resolveGroundZForTracking } from "../physics/surfaceHeight.js";
import { isTrain } from "../railway/Train.js";
import type { VehicleHornMessage } from "../shared/protocol.js";
import { boardingDistance, isDrivable } from "../traffic/Driving.js";
import {
  hasVehicleLights,
  isWarningVehicle,
  nextVehicleLightState,
} from "../traffic/EmergencyVehicle.js";
import { vehiclePerformance } from "../traffic/VehiclePerformance.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";
import { safeArrival } from "./SafeArrival.js";

/** Inside seats use ordinary replicated parenting/mount identity. Roof riders are independent. */
export class VehicleControl {
  private drivers = new Map<
    number,
    {
      session: PlayerSession;
      vehicle: Entity;
      lastInput: number;
      lastHorn?: number;
      lastHornEvent?: number;
      honking?: boolean;
    }
  >();
  constructor(private realm: Realm) {}
  private horns: VehicleHornMessage[] = [];
  honk(session: PlayerSession, active = true): void {
    const driver = this.drivers.get(session.player.id);
    if (!driver || typeof active !== "boolean") return;
    if (active && (session.editorEnabled || session.transitioning || session.retired)) return;
    const now = this.realm.worldAPI.time;
    if (active) driver.lastHorn = now;
    if (active === !!driver.honking && (!active || now - (driver.lastHornEvent ?? 0) < 0.1)) return;
    driver.honking = active;
    driver.lastHornEvent = now;
    const vehicle = driver.vehicle;
    this.horns.push({
      type: "vehicle-horn",
      vehicleId: vehicle.id,
      active,
      wx: vehicle.position.wx,
      wy: vehicle.position.wy,
      kind: isTrain(vehicle)
        ? "train"
        : vehiclePerformance(vehicle.type).pushWeight >= 500
          ? "heavy"
          : "car",
    });
  }
  takeHorns(): VehicleHornMessage[] {
    const horns = this.horns;
    this.horns = [];
    return horns;
  }
  get(session: PlayerSession): Entity | undefined {
    return this.drivers.get(session.player?.id)?.vehicle;
  }
  available(id: number): boolean {
    const car = this.realm.traffic?.states.get(id);
    if (car) return car.driverId === undefined && !car.shopping;
    const train = [...(this.realm.railway?.services.values() ?? [])].find((s) =>
      s.carriages.some((c) => c.id === id),
    );
    return !!train && train.driverId === undefined && !train.retiring && !train.record.deleted;
  }
  async restoreOnFoot(session: PlayerSession, fallback: Entity["position"]): Promise<void> {
    const r = this.realm;
    const position = await safeArrival(r, {
      x: fallback.wx / 16,
      y: fallback.wy / 16,
      generation: r.generation,
    });
    const reference = createPlayer(position.wx, position.wy);
    reference.wz = getSurfaceZ(position.wx, position.wy, (x, y) => r.world.getHeightAt(x, y));
    const placement = this.exitPlacement(reference, reference);
    if (!placement) throw Error("No clear place to restore the driver on foot.");
    session.player.position = placement.position;
    session.player.wz = session.player.groundZ = placement.wz;
    session.gameplaySession.lastSafePosition = { ...placement.position };
    r.entityManager.spatialHash.update(session.player);
  }
  enter(session: PlayerSession, id: number, restore = false): void {
    const r = this.realm,
      vehicle = r.entityManager.byId.get(id);
    if (!vehicle || !isDrivable(vehicle) || !vehicle.collider) throw Error("Vehicle unavailable.");
    const car = r.traffic?.states.get(id);
    const train = [...(r.railway?.services.values() ?? [])].find((s) =>
      s.carriages.includes(vehicle),
    );
    if ((!car && !train) || train?.retiring || train?.record.deleted)
      throw Error("Vehicle unavailable.");
    if (car?.shopping || car?.driverId !== undefined || train?.driverId !== undefined)
      throw Error("Someone is already driving.");
    if (
      !restore &&
      (session.editorEnabled ||
        session.transitioning ||
        session.retired ||
        session.gameplaySession.mountId !== null ||
        boardingDistance(session.player, vehicle) > 32 ||
        Math.abs((session.player.wz ?? 0) - (vehicle.wz ?? 0)) > 12)
    )
      throw Error("Stand beside the vehicle to enter.");
    if (!restore && Math.hypot(vehicle.velocity?.vx ?? 0, vehicle.velocity?.vy ?? 0) > 3)
      throw Error("Wait for the vehicle to stop.");
    if (r.saveManager?.pressured) throw Error("Saving is delayed. Please try again shortly.");
    if (car) r.traffic?.takeControl(car, session.player.id);
    if (train) {
      train.driverId = session.player.id;
      train.driveInput = 0;
      train.speed = 0;
      for (const c of train.carriages) c.velocity = { vx: 0, vy: 0 };
    }
    const p = session.player;
    p.parentId = id;
    p.localOffsetX = p.localOffsetY = 0;
    p.jumpZ = 0;
    delete p.jumpVZ;
    delete p.airMomentumX;
    delete p.airMomentumY;
    p.collider = null;
    p.velocity = { vx: 0, vy: 0 };
    session.gameplaySession.mountId = id;
    session.lastProcessedInputSeq = session.inputQueue.at(-1)?.seq ?? session.lastProcessedInputSeq;
    session.inputQueue = [];
    this.drivers.set(p.id, { session, vehicle, lastInput: r.worldAPI.time });
    this.sync();
    r.savePlayerData(session);
  }
  input(
    session: PlayerSession,
    input: { dx: number; dy: number; sprinting?: boolean; reversing?: boolean },
    dt: number,
  ): void {
    const driver = this.drivers.get(session.player.id);
    if (!driver) return;
    if (!Number.isFinite(input.dx) || !Number.isFinite(input.dy)) {
      this.stop(session);
      return;
    }
    driver.lastInput = this.realm.worldAPI.time;
    const car = this.realm.traffic?.states.get(driver.vehicle.id);
    if (car) this.realm.traffic?.drive(car, input, dt);
    const train = [...(this.realm.railway?.services.values() ?? [])].find(
      (s) => s.driverId === session.player.id,
    );
    if (train) {
      train.driveInput = Math.sign(input.dx || -input.dy);
      train.driveBoost = input.sprinting === true;
    }
    this.sync();
  }
  emergency(session: PlayerSession, action: "toggle" | "style"): void {
    const vehicle = this.get(session);
    if (
      !vehicle ||
      !hasVehicleLights(vehicle) ||
      (isWarningVehicle(vehicle) && action === "style") ||
      session.editorEnabled ||
      (action !== "toggle" && action !== "style")
    )
      return;
    vehicle.emergencyState = nextVehicleLightState(vehicle, action);
    const car = this.realm.traffic?.states.get(vehicle.id);
    if (car) this.realm.traffic?.onChange?.(car, false);
  }
  /** Cars hold across input gaps; trains brake on the service clock. */
  missingInput(session: PlayerSession): void {
    const train = [...(this.realm.railway?.services.values() ?? [])].find(
      (s) => s.driverId === session.player.id,
    );
    if (train) {
      train.driveInput = 0;
      train.driveBoost = false;
    }
  }
  stop(session: PlayerSession): void {
    const vehicle = this.get(session);
    if (!vehicle) return;
    vehicle.velocity = { vx: 0, vy: 0 };
    if (vehicle.sprite) vehicle.sprite.moving = false;
    const train = [...(this.realm.railway?.services.values() ?? [])].find(
      (s) => s.driverId === session.player.id,
    );
    if (train) {
      train.speed = 0;
      train.driveInput = 0;
      train.driveBoost = false;
      for (const c of train.carriages) c.velocity = { vx: 0, vy: 0 };
    }
  }
  exit(session: PlayerSession, forced = false): void {
    this.honk(session, false);
    const vehicle = this.get(session);
    if (!vehicle) return;
    this.stop(session);
    const placement = this.exitPlacement(session.player, vehicle);
    if (!placement && !forced)
      throw Error(
        isBoat(vehicle)
          ? "Move beside a clear shore to get out."
          : "No clear place to get out. Move somewhere open first.",
      );
    const car = this.realm.traffic?.states.get(vehicle.id);
    if (car) this.realm.traffic?.releaseControl(car, !forced);
    const train = [...(this.realm.railway?.services.values() ?? [])].find(
      (s) => s.driverId === session.player.id,
    );
    if (train) {
      delete train.driverId;
      delete train.driveInput;
      delete train.driveBoost;
      // Resume the next station in the current direction, including after manual reversal.
      if (train.line.path) {
        const distance = train.record.distance ?? 0,
          stops = train.line.path.stops;
        const next = train.record.target
          ? stops.findIndex((s) => s.distance > distance + 0.01)
          : stops.map((s) => s.distance < distance - 0.01).lastIndexOf(true);
        train.record.nextStop = next < 0 ? (train.record.target ? stops.length - 1 : 0) : next;
      }
      train.record.dwell = 8;
    }
    const p = session.player;
    delete p.parentId;
    delete p.localOffsetX;
    delete p.localOffsetY;
    p.collider = createPlayer(0, 0).collider;
    if (placement) {
      p.position = placement.position;
      p.wz = p.groundZ = placement.wz;
    } else {
      p.position = { ...(session.gameplaySession.lastSafePosition ?? vehicle.position) };
      p.wz = p.groundZ = 0;
    }
    p.prevPosition = { ...p.position };
    p.jumpZ = 0;
    delete p.jumpVZ;
    p.velocity = { vx: 0, vy: 0 };
    session.gameplaySession.mountId = null;
    session.gameplaySession.lastDismountedId = vehicle.id;
    session.gameplaySession.lastSafePosition = { ...p.position };
    session.lastProcessedInputSeq = session.inputQueue.at(-1)?.seq ?? session.lastProcessedInputSeq;
    session.inputQueue = [];
    this.drivers.delete(p.id);
    this.realm.entityManager.spatialHash.update(p);
    this.realm.savePlayerData(session);
  }
  sync(): void {
    for (const { session, vehicle, lastInput, lastHorn, honking } of [...this.drivers.values()]) {
      if (!this.realm.entityManager.byId.has(vehicle.id)) {
        this.exit(session, true);
        continue;
      }
      if (this.realm.worldAPI.time - lastInput > 0.25) this.stop(session);
      if (
        honking &&
        (this.realm.worldAPI.time - (lastHorn ?? 0) > 0.6 ||
          session.editorEnabled ||
          session.transitioning ||
          session.retired)
      )
        this.honk(session, false);
      const p = session.player;
      p.position = { ...vehicle.position };
      p.wz = p.groundZ = (vehicle.wz ?? 0) + (isBoat(vehicle) ? BOAT_SEAT_Z : 0);
      if (isBoat(vehicle) && p.sprite && vehicle.sprite) {
        p.sprite.direction = vehicle.sprite.direction;
        p.sprite.frameRow = vehicle.sprite.direction;
        p.sprite.moving = false;
      }
      p.jumpZ = 0;
      this.realm.entityManager.spatialHash.update(p);
    }
  }
  private exitPlacement(
    player: Entity,
    vehicle: Entity,
  ): { position: Entity["position"]; wz: number } | undefined {
    const r = this.realm,
      probe = createPlayer(0, 0),
      collider = probe.collider;
    if (!collider || !vehicle.collider) return;
    const b = getEntityAABB(vehicle.position, vehicle.collider);
    const x = Math.max(b.left, Math.min(b.right, player.position.wx));
    const y = Math.max(b.top, Math.min(b.bottom, player.position.wy));
    for (const gap of [16, 24, 32, 48, 64])
      for (const [wx, wy] of [
        [x, b.top - gap],
        [x, b.bottom + gap],
        [b.left - gap, y],
        [b.right + gap, y],
      ]) {
        if (wx === undefined || wy === undefined) continue;
        probe.position = { wx, wy };
        probe.wz = vehicle.wz ?? 0;
        const box = getEntityAABB(probe.position, collider);
        let ready = true;
        for (let ty = Math.floor(box.top / 16); ty <= Math.floor(box.bottom / 16); ty++)
          for (let tx = Math.floor(box.left / 16); tx <= Math.floor(box.right / 16); tx++)
            if (!r.world.getChunkIfLoaded(Math.floor(tx / 16), Math.floor(ty / 16))) ready = false;
        if (
          !ready ||
          aabbOverlapsSolid(
            box,
            (tx, ty) => r.world.getCollisionIfLoaded(tx, ty),
            CollisionFlag.Solid | CollisionFlag.Water,
          )
        )
          continue;
        const props = r.propManager.getPropsNearPosition(probe.position, collider);
        const z = resolveGroundZForTracking(
          probe,
          (tx, ty) => r.world.getHeightAt(tx, ty),
          props,
          [],
        );
        if (
          Math.abs(z - (vehicle.wz ?? 0)) > 16 ||
          props.some((p) =>
            aabbOverlapsPropWalls(box, p.position, p, z, collider.physicalHeight ?? 16),
          )
        )
          continue;
        if (
          r.entityManager.entities.some(
            (e) =>
              e.id !== player.id &&
              e.collider &&
              e.collider.solid !== false &&
              (e.wz ?? 0) < z + 16 &&
              (e.wz ?? 0) + (e.collider.physicalHeight ?? 16) > z &&
              aabbsOverlap(box, getEntityAABB(e.position, e.collider)),
          )
        )
          continue;
        return { position: probe.position, wz: z };
      }
  }
}
