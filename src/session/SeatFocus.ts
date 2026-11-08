import type { Entity } from "../entities/Entity.js";
import type { DeviceSession } from "./DeviceSession.js";

type Session = Pick<DeviceSession, "replica" | "prediction">;

/**
 * What a seat's view looks at (226). Seat 0 is the replica's predicted player; a
 * guest is found through the frame seat list, and its camera follows the body
 * it controls (its vehicle or mount, else itself), as the predictor does.
 */
function controlledBodyId(session: Session, seat: number): number | undefined {
  const id = session.replica.seats.entities.get(seat);
  if (id === undefined) return undefined;
  const own = session.replica.serverEntities.find((e) => e.id === id);
  return own ? (own.parentId ?? own.id) : undefined;
}

/** The seat's own entity as shown now: cutaway observer and marker exclusion. */
export function seatEntity(session: Session, seat: number): Entity | undefined {
  const { replica } = session;
  if (seat === 0) return replica.playerEntity.id === -1 ? undefined : replica.playerEntity;
  const id = replica.seats.entities.get(seat);
  return id === undefined ? undefined : replica.entities.find((e) => e.id === id);
}

/** A guest's controlled body at the latest predicted tick (fixed-step camera follow),
 * or its replica pose where the predictor does not publish it. */
export function seatBody(session: Session, seat: number): Entity | undefined {
  const id = controlledBodyId(session, seat);
  if (id === undefined) return undefined;
  return (
    session.prediction?.publishedBody(id).body ?? session.replica.entities.find((e) => e.id === id)
  );
}

/** A guest's controlled body as presented this display frame (inside the replica's
 * presentation, the predicted and eased pose). */
export function presentedSeatBody(session: Session, seat: number): Entity | undefined {
  const id = controlledBodyId(session, seat);
  return id === undefined ? undefined : session.replica.entities.find((e) => e.id === id);
}
