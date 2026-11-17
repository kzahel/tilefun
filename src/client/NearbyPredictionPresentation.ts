import type { Entity } from "../entities/Entity.js";
import { interpolateRotation } from "../physics/BodyRotation.js";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import { interpolateHeading } from "../rendering/PresentationTimeline.js";
import { motionLead, samplePredictedPose } from "./PredictionPresentation.js";

interface Handoff {
  selected: boolean;
  progress: number;
  at: number;
  // Last sampled pair, used to keep a departing actor moving with the buffer
  // when the predictor is finishing a sliced replay.
  buffered: { x: number; y: number; z: number };
  predicted: Entity;
}

interface CommittedFrame {
  bodies: ReadonlyMap<number, Entity>;
  alpha: number;
  local: ReadonlySet<number>;
  inContact(id: number): boolean;
}
type OwnsPose = (entity: Entity) => boolean;

const BASE_DURATION = 0.16;
const RELOCATION = 32;

function bufferPosition(entity: Entity): Handoff["buffered"] {
  return { x: entity.position.wx, y: entity.position.wy, z: entity.wz ?? 0 };
}

function mix(buffered: Entity, predicted: Entity, progress: number): Entity {
  if (progress <= 0) return buffered;
  if (progress >= 1) return predicted;
  const weight = progress * progress * (3 - 2 * progress);
  const lerp = (from: number, to: number) => from + (to - from) * weight;
  const position = {
    wx: lerp(buffered.position.wx, predicted.position.wx),
    wy: lerp(buffered.position.wy, predicted.position.wy),
  };
  const wz = lerp(buffered.wz ?? 0, predicted.wz ?? 0);
  const jumpZ = lerp(buffered.jumpZ ?? 0, predicted.jumpZ ?? 0);
  const heading = predicted.vehicleHeading;
  const rotation =
    buffered.bodyRotation &&
    predicted.bodyRotation &&
    interpolateRotation(buffered.bodyRotation, predicted.bodyRotation, weight);
  return {
    ...predicted,
    position,
    prevPosition: position,
    wz,
    prevWz: wz,
    jumpZ,
    prevJumpZ: jumpZ,
    ...(heading === undefined
      ? {}
      : {
          vehicleHeading: interpolateHeading(buffered.vehicleHeading ?? heading, heading, weight),
        }),
    ...(rotation ? { bodyRotation: rotation, prevBodyRotation: rotation } : {}),
  };
}

function carryWithBuffer(state: Handoff, buffered: Entity): Entity {
  const { predicted, buffered: previous } = state;
  const position = {
    wx: buffered.position.wx + predicted.position.wx - previous.x,
    wy: buffered.position.wy + predicted.position.wy - previous.y,
  };
  const wz = (buffered.wz ?? 0) + (predicted.wz ?? 0) - previous.z;
  return { ...predicted, position, prevPosition: position, wz, prevWz: wz };
}

/** Display-only blend for independent bodies crossing the prediction boundary. */
export class NearbyPredictionPresentation {
  private readonly handoffs = new Map<number, Handoff>();

  clear(): void {
    this.handoffs.clear();
  }

  present(
    buffered: readonly Entity[],
    selected: Map<number, Entity>,
    now: number,
    committed?: CommittedFrame,
    carrierOwns?: OwnsPose,
  ): Entity[] {
    if (!this.handoffs.size && !selected.size) return [...buffered];
    const remaining = new Set(this.handoffs.keys());
    const shown = buffered.map((entity) => {
      const id = entity.id;
      const state = this.handoffs.get(id);
      if (state) remaining.delete(id);
      const selectedPose = selected.get(id);
      const pose = this.presentBody(
        entity,
        selectedPose,
        state,
        now,
        committed,
        carrierOwns?.(selectedPose ?? entity) === true,
      );
      if (selectedPose) selected.set(id, pose);
      return pose;
    });
    for (const id of remaining) this.handoffs.delete(id);
    return shown;
  }

  private presentBody(
    entity: Entity,
    selectedPose: Entity | undefined,
    state: Handoff | undefined,
    now: number,
    committed: CommittedFrame | undefined,
    carrierOwns: boolean,
  ): Entity {
    const { id } = entity;
    if (!committed && selectedPose) {
      if (state) state.at = now;
      return selectedPose; // Hold the last committed draw during replay.
    }
    if (!selectedPose && !state) return entity;
    if (carrierOwns || committed?.local.has(id)) {
      this.handoffs.delete(id);
      return selectedPose ?? entity;
    }
    if (committed?.inContact(id)) {
      // Draw the solved contact immediately, then begin any later release
      // from its predicted pose even when proximity is still selecting it.
      if (selectedPose)
        this.handoffs.set(id, {
          buffered: bufferPosition(entity),
          predicted: selectedPose,
          selected: true,
          progress: 1,
          at: now,
        });
      else this.handoffs.delete(id);
      return selectedPose ?? entity;
    }
    const body = committed?.bodies.get(id);
    const predicted =
      selectedPose ??
      (committed
        ? body && samplePredictedPose(body, committed.alpha, entity.sprite)
        : state && carryWithBuffer(state, entity));
    if (!predicted) {
      this.handoffs.delete(id);
      return entity;
    }
    return this.blend(entity, predicted, !!selectedPose, now, state, body);
  }

  private blend(
    buffered: Entity,
    predicted: Entity,
    selected: boolean,
    now: number,
    state: Handoff | undefined,
    body: Entity | undefined,
  ): Entity {
    const dx = predicted.position.wx - buffered.position.wx;
    const dy = predicted.position.wy - buffered.position.wy;
    const prev = body?.prevPosition ?? body?.position;
    const vx =
      body && prev ? (body.position.wx - prev.wx) / PHYSICS_DT : (predicted.velocity?.vx ?? 0);
    const vy =
      body && prev ? (body.position.wy - prev.wy) / PHYSICS_DT : (predicted.velocity?.vy ?? 0);
    // A difference explained by up to two seconds of travel is a timeline lead.
    // A discontinuity beyond that allowance takes effect immediately.
    const lead = motionLead(dx, dy, vx, vy);
    const dz = (predicted.wz ?? 0) - (buffered.wz ?? 0);
    const relocated = Math.hypot(dx - vx * lead, dy - vy * lead, dz) >= RELOCATION;
    // Smoothstep's maximum slope is 1.5. Spread the longitudinal gap over
    // at least three times its lead to cap normal catch-up at half cruise speed.
    const duration = Math.max(BASE_DURATION, 3 * Math.abs(lead));
    const dt = state?.selected === selected ? Math.max(0, now - state.at) : 0;
    const target = Number(selected);
    const start = state?.progress ?? 0;
    const progress = relocated
      ? target
      : Math.max(0, Math.min(1, start + (selected ? dt : -dt) / duration));
    if (!selected && progress === 0) this.handoffs.delete(buffered.id);
    else
      this.handoffs.set(buffered.id, {
        predicted,
        buffered: bufferPosition(buffered),
        selected,
        progress,
        at: now,
      });
    return mix(buffered, predicted, progress);
  }
}
