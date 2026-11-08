import type { Entity } from "../entities/Entity.js";
import { MAX_PREDICTION_BODIES, type PhysicsBodyState, PREDICTION_RADIUS } from "./PhysicsState.js";

/** What prediction selection reads of a scene body: its entity and cached numerical state. */
interface PredictionBody {
  readonly entity: Entity;
  readonly state: PhysicsBodyState;
}

interface Candidate {
  id: number;
  distance: number;
}

/** The bodies a prediction snapshot carries, in priority order, and how many it left out. */
export interface PredictionSelection<B> {
  readonly selected: ReadonlyMap<number, B>;
  readonly omitted: number;
}

/**
 * Prediction context around one anchor per local seat (226): every anchor's contact graph,
 * then bodies near any anchor, nearest anchor first, under one body limit. One anchor
 * selects exactly what a single seat's snapshot always did. Missing anchors are skipped.
 */
export function selectAround<B extends PredictionBody>(
  bodies: ReadonlyMap<number, B>,
  contacts: ReadonlyMap<number, ReadonlySet<number>>,
  anchorIds: readonly number[],
  visible: ReadonlySet<number>,
): PredictionSelection<B> {
  const anchors = anchorIds.flatMap((id) => bodies.get(id) ?? []);
  const selected = new Map<number, B>();
  if (!anchors.length) return { selected, omitted: 0 };
  const required = requiredAround(bodies, contacts, anchorIds);
  const candidates = nearAnchors(bodies, anchors, required);
  candidates.sort(
    (a, b) =>
      Number(required.has(b.id)) - Number(required.has(a.id)) ||
      a.distance - b.distance ||
      a.id - b.id,
  );
  for (const { id } of candidates)
    if (visible.has(id) && selected.size < MAX_PREDICTION_BODIES) {
      const entry = bodies.get(id);
      if (entry) selected.set(id, entry);
    }
  return { selected, omitted: candidates.length - selected.size };
}

/** Bodies an anchor cannot be replayed without: its contacts and supports, transitively. */
function requiredAround<B extends PredictionBody>(
  bodies: ReadonlyMap<number, B>,
  contacts: ReadonlyMap<number, ReadonlySet<number>>,
  anchorIds: readonly number[],
): Set<number> {
  const required = new Set<number>();
  const queue = [...anchorIds];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (id === undefined || required.has(id) || !bodies.has(id)) continue;
    required.add(id);
    for (const neighbor of contacts.get(id) ?? [])
      if (!required.has(neighbor)) queue.push(neighbor);
    const support = bodies.get(id)?.state.supportId;
    if (support !== undefined && !required.has(support)) queue.push(support);
  }
  return required;
}

/** Required bodies and bodies within the radius of any anchor, with their whole consists. */
function nearAnchors<B extends PredictionBody>(
  bodies: ReadonlyMap<number, B>,
  anchors: readonly B[],
  required: Set<number>,
): Candidate[] {
  const candidates: Candidate[] = [];
  const groups = new Set<number>();
  for (const [id, entry] of bodies) {
    const half =
      Math.hypot(entry.entity.collider?.width ?? 0, entry.entity.collider?.height ?? 0) / 2;
    const distance = Math.min(
      ...anchors.map((anchor) =>
        Math.hypot(
          entry.entity.position.wx - anchor.entity.position.wx,
          entry.entity.position.wy - anchor.entity.position.wy,
        ),
      ),
    );
    if (distance <= PREDICTION_RADIUS + half || required.has(id)) {
      candidates.push({ id, distance });
      if (entry.entity.physicsGroupId !== undefined) groups.add(entry.entity.physicsGroupId);
    }
  }
  // A prescribed consist is one coherent prediction dependency even when its
  // distant end lies outside the local radius or has no solved contact pair.
  if (!groups.size) return candidates;
  const candidateIds = new Set(candidates.map((c) => c.id));
  for (const [id, entry] of bodies)
    if (entry.entity.physicsGroupId !== undefined && groups.has(entry.entity.physicsGroupId)) {
      required.add(id);
      if (!candidateIds.has(id))
        candidates.push({
          id,
          distance: Math.min(
            ...anchors.map((anchor) =>
              Math.hypot(entry.state.x - anchor.state.x, entry.state.y - anchor.state.y),
            ),
          ),
        });
    }
  return candidates;
}
