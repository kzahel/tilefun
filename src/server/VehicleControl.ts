import { isBoat } from "../boats/Boat.js";
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
import { endShoppingVisit } from "../traffic/ShoppingVisits.js";
import { boardingHeightLimit } from "../traffic/Transporter.js";
import { isVehicle, isVehicleOverturned } from "../traffic/Vehicle.js";
import { vehiclePerformance } from "../traffic/VehiclePerformance.js";
import { boardingDistance, isDrivable, vehicleVerticalDistance } from "../traffic/VehicleSeats.js";
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
      /** Where the driver stood before boarding: the guaranteed way back out. */
      boarded?: ExitPlacement;
      lastHorn?: number;
      lastHornEvent?: number;
      lastHornStartle?: number;
      honking?: boolean;
    }
  >();
  constructor(readonly realm: Realm) {}
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
    if (vehicle.towedBy !== undefined || vehicle.transportedBy !== undefined)
      throw Error("Release this car from its truck first.");
    if (
      !restore &&
      (session.editorEnabled ||
        session.transitioning ||
        session.retired ||
        session.gameplaySession.mountId !== null ||
        boardingDistance(session.player, vehicle) > 32 ||
        Math.abs((session.player.wz ?? 0) - (vehicle.wz ?? 0)) >
          boardingHeightLimit(vehicle, r.entityManager.entities))
    )
      throw Error("Stand beside the vehicle to enter.");
    if (!restore && Math.hypot(vehicle.velocity?.vx ?? 0, vehicle.velocity?.vy ?? 0) > 3)
      throw Error("Wait for the vehicle to stop.");
    if (r.saveManager?.pressured) throw Error("Saving is delayed. Please try again shortly.");
    if (r.vehicleRegistry) endShoppingVisit(r.vehicleRegistry, car);
    r.vehicleRegistry?.takeControl(car, session.player.id);
    const p = session.player;
    const boarded = restore ? undefined : { position: { ...p.position }, wz: p.wz ?? 0 };
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
    this.drivers.set(p.id, { session, vehicle, ...(boarded ? { boarded } : {}) });
    this.sync();
    r.savePlayerData(session);
  }
  recover(session: PlayerSession, id: number) {
    const car = this.realm.vehicleRegistry?.states.get(id),
      vehicle = car?.entity;
    if (
      !car ||
      !vehicle ||
      isBoat(vehicle) ||
      !isVehicleOverturned(vehicle) ||
      session.editorEnabled ||
      session.transitioning ||
      session.retired ||
      (car.driverId !== undefined && car.driverId !== session.player.id) ||
      (this.get(session) !== vehicle &&
        (boardingDistance(session.player, vehicle) > 32 ||
          vehicleVerticalDistance(session.player, vehicle) > 16))
    )
      throw Error("Stand beside an overturned vehicle to right it.");
    if (Math.hypot(vehicle.velocity?.vx ?? 0, vehicle.velocity?.vy ?? 0, vehicle.jumpVZ ?? 0) > 8)
      throw Error("Wait for the vehicle to settle.");
    if (this.get(session) === vehicle) this.stop(session);
    this.realm.recoverVehicle(id);
    this.realm.entityManager.spatialHash.update(vehicle);
    this.realm.vehicleRegistry?.onChange?.(car, false);
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
  exit(session: PlayerSession): void {
    this.honk(session, false);
    const vehicle = this.get(session);
    if (!vehicle) return;
    this.stop(session);
    // Getting out always succeeds. With no open ground or clear roof nearby,
    // return the player to where they boarded, or (after a reload into the
    // seat) onto the roof regardless.
    const placement = this.exitPlacement(session.player, vehicle) ??
      this.drivers.get(session.player.id)?.boarded ?? {
        position: { ...vehicle.position },
        wz: (vehicle.wz ?? 0) + (vehicle.collider?.physicalHeight ?? 0),
      };
    const car = this.realm.vehicleRegistry?.states.get(vehicle.id);
    if (car) this.realm.vehicleRegistry?.releaseControl(car);
    const p = session.player;
    delete p.parentId;
    delete p.localOffsetX;
    delete p.localOffsetY;
    replaceBodyCollider(p, createPlayer(0, 0).collider);
    teleportBody(p, { ...placement.position, wz: placement.wz });
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
        this.exit(session);
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
  /**
   * Getting out must not strand a player in a wedged or tipped vehicle. Prefer
   * level ground beside the body, then its roof (the existing roof-standing
   * surface) when there is headroom, then any open ground a little further out.
   */
  private exitPlacement(player: Entity, vehicle: Entity): ExitPlacement | undefined {
    const collider = createPlayer(0, 0).collider;
    if (!collider || !vehicle.collider) return;
    const b = getEntityAABB(vehicle.position, vehicle.collider);
    const vz = vehicle.wz ?? 0;
    const reach = EXIT_GAPS.at(-1) ?? 0;
    const near = Math.hypot(b.right - b.left, b.bottom - b.top) / 2 + reach + 32;
    const cx = (b.left + b.right) / 2,
      cy = (b.top + b.bottom) / 2;
    const blockers = this.realm.entityManager.entities.filter(
      (e) =>
        e.id !== player.id &&
        e.id !== vehicle.id &&
        !!e.collider &&
        e.collider.solid !== false &&
        Math.hypot(e.position.wx - cx, e.position.wy - cy) <= near + 64,
    );
    const ground = (gaps: readonly number[], level: boolean) => {
      for (const gap of gaps)
        for (const [wx, wy] of perimeter(b, gap)) {
          const placement = this.clearSpot(collider, blockers, { wx, wy }, vz);
          if (placement && (!level || Math.abs(placement.wz - vz) <= EXIT_STEP)) return placement;
        }
      return undefined;
    };
    const level = ground(LEVEL_EXIT_GAPS, true);
    if (level) return level;
    if (isVehicle(vehicle)) {
      const roof = this.clearSpot(
        collider,
        blockers,
        { wx: cx, wy: cy },
        vz + (vehicle.collider.physicalHeight ?? 0),
        true,
      );
      if (roof) return roof;
    }
    return ground(EXIT_GAPS, false);
  }
  /** Ground (or explicit roof height) spot clear of tiles, prop walls and solid bodies. */
  private clearSpot(
    collider: NonNullable<Entity["collider"]>,
    blockers: readonly Entity[],
    position: Entity["position"],
    wz: number,
    roof = false,
  ): ExitPlacement | undefined {
    const r = this.realm;
    const box = getEntityAABB(position, collider);
    for (let ty = Math.floor(box.top / 16); ty <= Math.floor(box.bottom / 16); ty++)
      for (let tx = Math.floor(box.left / 16); tx <= Math.floor(box.right / 16); tx++)
        if (!r.world.getChunkIfLoaded(Math.floor(tx / 16), Math.floor(ty / 16))) return;
    // A roof spot stands on the vehicle, so water beneath it is irrelevant.
    const mask = roof ? CollisionFlag.Solid : CollisionFlag.Solid | CollisionFlag.Water;
    if (aabbOverlapsSolid(box, (tx, ty) => r.world.getCollisionIfLoaded(tx, ty), mask)) return;
    const props = r.propManager.getPropsNearPosition(position, collider);
    const z = roof
      ? wz
      : placementGroundZ(
          { position, collider, id: -1, wz },
          (tx, ty) => r.world.getHeightAt(tx, ty),
          props,
        );
    const height = collider.physicalHeight ?? 16;
    if (props.some((p) => aabbOverlapsPropWalls(box, p.position, p, z, height))) return;
    if (
      blockers.some(
        (e) =>
          e.collider &&
          (e.wz ?? 0) < z + height &&
          (e.wz ?? 0) + (e.collider.physicalHeight ?? 16) > z &&
          aabbsOverlap(box, getEntityAABB(e.position, e.collider)),
      )
    )
      return;
    return { position: { ...position }, wz: z };
  }
}

type ExitPlacement = { position: Entity["position"]; wz: number };
/** Stepping out may change height only as much as an ordinary step. */
const EXIT_STEP = 16;
const LEVEL_EXIT_GAPS = [16, 24, 32, 48, 64] as const;
const EXIT_GAPS = [...LEVEL_EXIT_GAPS, 96, 128] as const;

/** Candidate feet positions around a body footprint, nearest first. */
function perimeter(b: ReturnType<typeof getEntityAABB>, gap: number): [number, number][] {
  const left = b.left - gap,
    right = b.right + gap,
    top = b.top - gap,
    bottom = b.bottom + gap;
  const cx = (b.left + b.right) / 2,
    cy = (b.top + b.bottom) / 2;
  const points: [number, number][] = [];
  const step = 8;
  for (let x = left; x <= right; x += step) points.push([x, top], [x, bottom]);
  for (let y = top + step; y < bottom; y += step) points.push([left, y], [right, y]);
  return points.sort((a, c) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(c[0] - cx, c[1] - cy));
}
