import {
  aabbOverlapsPropWalls,
  aabbOverlapsSolid,
  aabbsOverlap,
  getEntityAABB,
} from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import {
  replaceBodyCollider,
  setHorizontalVelocity,
  teleportBody,
} from "../physics/PhysicalEdits.js";
import { getSurfaceZ, placementGroundZ } from "../physics/surfaceHeight.js";
import type { VehicleHornMessage } from "../shared/protocol.js";
import {
  hasVehicleLights,
  isWarningVehicle,
  nextVehicleLightState,
} from "../traffic/EmergencyVehicle.js";
import { vehiclePerformance } from "../traffic/VehiclePerformance.js";
import { boardingDistance, isDrivable } from "../traffic/VehicleSeats.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { HORN_STARTLE_COOLDOWN, HORN_STARTLE_RADIUS, reactToHorn } from "./HornReaction.js";
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
      lastHorn?: number;
      lastHornEvent?: number;
      lastHornStartle?: number;
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
    const starting = active && !driver.honking;
    driver.honking = active;
    driver.lastHornEvent = now;
    const vehicle = driver.vehicle;
    if (starting && now - (driver.lastHornStartle ?? -Infinity) >= HORN_STARTLE_COOLDOWN) {
      driver.lastHornStartle = now;
      for (const entity of this.realm.entityManager.spatialHash.queryRadius(
        vehicle.position.wx,
        vehicle.position.wy,
        HORN_STARTLE_RADIUS,
      ))
        if (reactToHorn(entity, vehicle)) this.realm.records?.changed(entity);
    }
    this.horns.push({
      type: "vehicle-horn",
      vehicleId: vehicle.id,
      active,
      wx: vehicle.position.wx,
      wy: vehicle.position.wy,
      kind: vehiclePerformance(vehicle.type).pushWeight >= 500 ? "heavy" : "car",
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
    const state = this.realm.vehicleRegistry?.states.get(id);
    return !!state && isDrivable(state.entity) && state.driverId === undefined;
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
    teleportBody(session.player, { ...placement.position, wz: placement.wz });
    session.gameplaySession.lastSafePosition = { ...placement.position };
    r.entityManager.spatialHash.update(session.player);
  }
  enter(session: PlayerSession, id: number, restore = false): void {
    const r = this.realm,
      vehicle = r.entityManager.byId.get(id);
    const car = r.vehicleRegistry?.states.get(id);
    if (!vehicle || !isDrivable(vehicle) || !vehicle.collider || !car)
      throw Error("Vehicle unavailable.");
    if (car.driverId !== undefined) throw Error("Someone is already driving.");
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
    r.vehicleRegistry?.takeControl(car, session.player.id);
    const p = session.player;
    p.parentId = id;
    p.localOffsetX = p.localOffsetY = 0;
    p.jumpZ = 0;
    delete p.jumpVZ;

    replaceBodyCollider(p, null);
    setHorizontalVelocity(p, { vx: 0, vy: 0 });
    session.gameplaySession.mountId = id;
    session.lastProcessedInputSeq = session.inputQueue.at(-1)?.seq ?? session.lastProcessedInputSeq;
    session.inputQueue = [];
    session.controls.reset(session.lastProcessedInputSeq);
    this.drivers.set(p.id, { session, vehicle });
    this.sync();
    r.savePlayerData(session);
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
    const car = this.realm.vehicleRegistry?.states.get(vehicle.id);
    if (car) this.realm.vehicleRegistry?.onChange?.(car, false);
  }
  stop(session: PlayerSession): void {
    const vehicle = this.get(session);
    if (!vehicle) return;
    vehicle.motionIntent = { vx: 0, vy: 0 };
    if (vehicle.sprite) vehicle.sprite.moving = false;
    session.inputQueue = [];
    session.controls.reset(session.lastProcessedInputSeq);
  }
  exit(session: PlayerSession, forced = false): void {
    this.honk(session, false);
    const vehicle = this.get(session);
    if (!vehicle) return;
    this.stop(session);
    const placement = this.exitPlacement(session.player, vehicle);
    if (!placement && !forced) throw Error("No clear place to get out. Move somewhere open first.");
    const car = this.realm.vehicleRegistry?.states.get(vehicle.id);
    if (car) this.realm.vehicleRegistry?.releaseControl(car);
    const p = session.player;
    delete p.parentId;
    delete p.localOffsetX;
    delete p.localOffsetY;
    replaceBodyCollider(p, createPlayer(0, 0).collider);
    teleportBody(
      p,
      placement
        ? { ...placement.position, wz: placement.wz }
        : {
            ...(session.gameplaySession.lastSafePosition ?? vehicle.position),
            wz: 0,
          },
    );
    session.gameplaySession.mountId = null;
    session.gameplaySession.lastDismountedId = vehicle.id;
    session.gameplaySession.lastSafePosition = { ...p.position };
    session.lastProcessedInputSeq = session.inputQueue.at(-1)?.seq ?? session.lastProcessedInputSeq;
    session.inputQueue = [];
    session.controls.reset(session.lastProcessedInputSeq);
    this.drivers.delete(p.id);
    this.realm.entityManager.spatialHash.update(p);
    this.realm.savePlayerData(session);
  }
  sync(): void {
    for (const { session, vehicle, lastHorn, honking } of [...this.drivers.values()]) {
      if (!this.realm.entityManager.byId.has(vehicle.id)) {
        this.exit(session, true);
        continue;
      }
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
      p.wz = p.groundZ = vehicle.wz ?? 0;
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
        const z = placementGroundZ(probe, (tx, ty) => r.world.getHeightAt(tx, ty), props);
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
