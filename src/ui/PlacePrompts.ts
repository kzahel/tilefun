import type { ClientStateView } from "../client/ClientStateView.js";
import { buildingRecipe } from "../generation/regional/BuildingRecipes.js";
import { buildingDoors, exteriorDoors } from "../interiors/BuildingDoors.js";
import { DoorApproach, doorwayReached, towardDoor } from "../interiors/DoorTraversal.js";
import { nearestStationBench } from "../railway/StationBench.js";
import { occupiedVehicle } from "../traffic/VehicleSeats.js";
import { driveCandidate, type EquipmentRequest, equipmentPrompt } from "./VehicleEquipment.js";

/**
 * The E/F place choices of one seat (226): the vehicle it can get into or out of, a
 * train to call, its equipment action, and the door it can take. Seat 0's page
 * controls and guests' prompts read the same choices over their own seat's view.
 */

/** A seat's view of the replica: its own body (predicted where the predictor
 * publishes it), its authoritative pose, and the shared world around it. */
export type PlaceView = Pick<
  ClientStateView,
  "playerEntity" | "entities" | "props" | "editorEnabled" | "interior" | "serverPlayerPosition"
>;

export type VehicleRequest =
  | { type: "call-train"; benchId: number }
  | { type: "enter-vehicle"; entityId: number }
  | { type: "exit-vehicle" }
  | EquipmentRequest;

export type DoorRequest =
  | { type: "enter-building"; featureId: string; doorId?: string; walkThrough?: boolean }
  | { type: "exit-building"; doorId?: string; walkThrough?: boolean };

export interface VehicleChoice {
  /** Get in or out, or call a train; null when there is none or it is not allowed. */
  readonly request: VehicleRequest | null;
  /** "Get out", "Call train" or "Drive car". */
  readonly label: string;
  /** The one contextual equipment action (right a car, dump bed, tow, transporter). */
  readonly equipment: { request: EquipmentRequest; label: string } | null;
  /** The target; a message about it is stale once this changes. */
  readonly key: string;
  /** The seat is in a vehicle (its driving hints show). */
  readonly inside: boolean;
}

export function vehicleChoice(view: PlaceView, allowed: boolean): VehicleChoice {
  const p = view.playerEntity,
    entities = view.entities,
    current = occupiedVehicle(p, entities);
  const candidate = current ?? driveCandidate(p, entities);
  const equipment = equipmentPrompt(view, allowed);
  const bench = !current && !candidate ? nearestStationBench(p, view.props) : undefined;
  const key = current
    ? `inside:${current.id}`
    : candidate
      ? `near:${candidate.id}`
      : equipment
        ? `${equipment.request.type}:${equipment.request.entityId}`
        : bench
          ? `station:${bench.id}`
          : "";
  const request = allowed && !view.editorEnabled ? seatRequest(current, candidate, bench) : null;
  const label = current ? "Get out" : bench ? "Call train" : "Drive car";
  return { request, label, equipment, key, inside: !!current };
}

/** Out of the vehicle the seat is in, into the nearest one, or a train to its bench. */
function seatRequest(
  current: { id: number } | undefined,
  candidate: { id: number } | undefined,
  bench: { id: number } | undefined,
): VehicleRequest | null {
  if (current) return { type: "exit-vehicle" };
  if (candidate) return { type: "enter-vehicle", entityId: candidate.id };
  return bench ? { type: "call-train", benchId: bench.id } : null;
}

export interface DoorChoice {
  /** The nearest door within reach; null when there is none or it is not allowed. */
  readonly request: DoorRequest | null;
  /** "Enter shop", "Return to street", …; empty without a request. */
  readonly label: string;
  /** Doors within reach (a fresh approach ignores the ones it started beside). */
  readonly nearby: readonly string[];
  /** The doorway the seat stands in, if any (walking into it goes through). */
  readonly threshold: string | null;
}

function doorLabel(type: string): string {
  if (type === "prop-country-house") return "Enter home";
  if (type === "prop-shed") return "Enter outbuilding";
  return buildingRecipe(type)?.kind === "shop" ? "Enter shop" : "Enter apartment";
}

/** Inside a building: its nearest door back to the street. */
function exitChoice(view: PlaceView, interior: NonNullable<PlaceView["interior"]>): DoorChoice {
  const p = view.playerEntity.position;
  const doors = buildingDoors(interior);
  const nearby = doors
    .filter((d) => Math.hypot(p.wx - d.inside.wx, p.wy - d.inside.wy) <= 32)
    .map((d) => d.id);
  const door = doors
    .map((door) => ({ door, distance: Math.hypot(p.wx - door.inside.wx, p.wy - door.inside.wy) }))
    .filter(({ distance }) => distance <= 40)
    .sort((a, b) => a.distance - b.distance)[0]?.door;
  if (!door) return { request: null, label: "", nearby, threshold: null };
  return {
    request: { type: "exit-building", doorId: door.id },
    label: "Return to street",
    nearby,
    threshold: doorwayReached(view, door.inside, false) ? door.id : null,
  };
}

/** Outside: the nearest building door within reach, on the ground. */
function enterChoice(view: PlaceView): DoorChoice {
  const p = view.playerEntity.position;
  const nearby: string[] = [];
  let choice: DoorChoice = { request: null, label: "", nearby, threshold: null };
  if ((view.playerEntity.wz ?? 0) > 8) return choice;
  let best = 32;
  for (const prop of view.props) {
    if (!prop.proceduralId) continue;
    for (const door of exteriorDoors(prop)) {
      const distance = Math.hypot(p.wx - door.outside.wx, p.wy - door.outside.wy);
      const key = `${prop.proceduralId}:${door.id}`;
      if (distance <= 32) nearby.push(key);
      if (distance > best) continue;
      best = distance;
      choice = {
        request: { type: "enter-building", featureId: prop.proceduralId, doorId: door.id },
        label: doorLabel(prop.type),
        nearby,
        threshold: doorwayReached(view, door.outside, true) ? key : null,
      };
    }
  }
  return choice;
}

export function doorChoice(view: PlaceView, allowed: boolean): DoorChoice {
  if (!allowed) return { request: null, label: "", nearby: [], threshold: null };
  return view.interior ? exitChoice(view, view.interior) : enterChoice(view);
}

/** Walking into a doorway goes through: a fresh approach after spawn, realm
 * changes or any attempted trip, on the ground, moving toward the door. */
export class DoorWalk {
  private readonly approach = new DoorApproach();
  private realmKey = "";

  reset(): void {
    this.approach.reset();
  }

  /** Whether the seat walks through its doorway now. */
  update(
    view: PlaceView,
    choice: DoorChoice,
    allowed: boolean,
    locked: boolean,
    movement: { dx: number; dy: number },
    dt: number,
  ): boolean {
    const realmKey = JSON.stringify(view.interior);
    if (realmKey !== this.realmKey || !allowed || view.editorEnabled || locked)
      this.approach.reset();
    this.realmKey = realmKey;
    return (
      allowed &&
      !view.editorEnabled &&
      !locked &&
      (view.playerEntity.wz ?? 0) <= 1 &&
      this.approach.update(
        choice.nearby,
        choice.threshold,
        towardDoor(movement.dx, movement.dy, !view.interior),
        dt,
      )
    );
  }
}
