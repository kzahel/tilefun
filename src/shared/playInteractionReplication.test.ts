import { expect, it } from "vitest";
import { createChicken } from "../entities/Chicken.js";
import { isBefriendHit } from "../game/playInteraction.js";
import { decodeServerMessage, encodeServerMessage } from "./binaryCodec.js";
import { applyEntityDelta, diffEntitySnapshots } from "./entityDelta.js";
import type { FrameMessage } from "./protocol.js";
import { deserializeEntity, serializeEntity } from "./serialization.js";

it("live tag eligibility crosses binary baselines and deltas in both directions", () => {
  const entity = createChicken(100, 200);
  const baseline = serializeEntity(entity);
  const frame = decodeServerMessage(
    encodeServerMessage({
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 0,
      entityBaselines: [baseline],
    }),
  ) as FrameMessage;
  const b = frame.entityBaselines?.[0];
  if (!b) throw new Error("Missing baseline");
  const replica = deserializeEntity(b);
  expect(
    isBefriendHit(
      124,
      200,
      replica.position.wx,
      replica.position.wy,
      replica.wanderAI?.befriendable === true,
    ),
  ).toBe(true);
  expect(isBefriendHit(125, 200, replica.position.wx, replica.position.wy, true)).toBe(false);
  let previous = baseline;
  for (const enabled of [false, true]) {
    if (enabled) entity.tags?.add("befriendable");
    else entity.tags?.delete("befriendable");
    const next = serializeEntity(entity);
    const delta = diffEntitySnapshots(previous, next);
    if (!delta) throw new Error("Eligibility change needs a delta");
    const f = decodeServerMessage(
      encodeServerMessage({
        type: "frame",
        serverTick: 2,
        lastProcessedInputSeq: 0,
        playerEntityId: 0,
        entityDeltas: [delta],
      }),
    ) as FrameMessage;
    const d = f.entityDeltas?.[0];
    if (!d) throw new Error("Missing delta");
    applyEntityDelta(replica, d);
    expect(replica.wanderAI?.befriendable).toBe(enabled);
    replica.wanderAI = null;
    applyEntityDelta(replica, d);
    expect(replica).toHaveProperty("wanderAI.befriendable", enabled);
    previous = next;
  }
});
