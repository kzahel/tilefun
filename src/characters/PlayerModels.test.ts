import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import { createPlayer, updatePlayerFromInput } from "../entities/Player.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import { applyEntityDelta, diffEntitySnapshots } from "../shared/entityDelta.js";
import type { FrameMessage } from "../shared/protocol.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { applyPlayerModel, isPlayerModel, PLAYER_MODELS } from "./PlayerModels.js";
import { PROMOTED_CHARACTERS } from "./PromotedCharacters.js";

function wire(frame: Partial<FrameMessage>): FrameMessage {
  return decodeServerMessage(
    encodeServerMessage({
      type: "frame",
      serverTick: 1,
      lastProcessedInputSeq: 0,
      playerEntityId: 1,
      ...frame,
    }),
  ) as FrameMessage;
}

describe("promoted characters", () => {
  it.each(PROMOTED_CHARACTERS)(
    "$name pins approved pixels and reconstructs identical NPC geometry",
    (def) => {
      expect(
        createHash("sha256")
          .update(readFileSync(`public/${def.image}`))
          .digest("hex"),
      ).toBe(def.approval.sourceFingerprint);
      expect(
        createHash("sha256")
          .update(
            JSON.stringify({
              candidate: def.approval.candidateFingerprint,
              settings: def.defaults,
            }),
          )
          .digest("hex"),
      ).toBe(def.approval.settingsFingerprint);
      const npc = required(ENTITY_FACTORIES[def.sheetKey])(40, 50);
      const snapshot = required(
        wire({ entityBaselines: [serializeEntity(npc)] }).entityBaselines?.[0],
      );
      const copy = deserializeEntity(snapshot);
      expect(copy.sprite).toEqual(npc.sprite);
      expect(copy.collider).toEqual(npc.collider);
      expect(copy.sortOffsetY).toBe(npc.sortOffsetY);
      expect(copy.wanderAI?.speed).toBe(def.defaults.speed);
    },
  );
});

describe("player appearance", () => {
  it.each(PLAYER_MODELS)(
    "$name roundtrips baseline and live delta without changing player physics",
    (model) => {
      const p = createPlayer(12, 30);
      const collider = structuredClone(p.collider);
      const before = serializeEntity(p);
      const replica = deserializeEntity(before);
      applyPlayerModel(p, model.id);
      updatePlayerFromInput(p, { dx: 1, dy: 0, sprinting: true, jump: false }, 1 / 60);
      const classic = createPlayer(12, 30);
      updatePlayerFromInput(classic, { dx: 1, dy: 0, sprinting: true, jump: false }, 1 / 60);
      expect(p.velocity).toEqual(classic.velocity);
      expect(p.collider).toEqual(collider);
      expect(p.type).toBe("player");
      expect(p.wanderAI).toBeNull();
      const after = serializeEntity(p);
      const copy = deserializeEntity(
        required(wire({ entityBaselines: [after] }).entityBaselines?.[0]),
      );
      expect(copy.sprite).toEqual(p.sprite);
      expect(copy.collider).toEqual(collider);
      const delta = required(diffEntitySnapshots(before, after));
      applyEntityDelta(replica, required(wire({ entityDeltas: [delta] }).entityDeltas?.[0]));
      expect(replica.sprite).toEqual(p.sprite);
      applyPlayerModel(p, "player");
      const reset = diffEntitySnapshots(after, serializeEntity(p));
      if (reset)
        applyEntityDelta(replica, required(wire({ entityDeltas: [reset] }).entityDeltas?.[0]));
      expect(replica.sprite?.sheetKey).toBe("player");
      expect(replica.sprite?.drawOffsetY).toBeUndefined();
      expect(replica.collider).toEqual(collider);
    },
  );
  it("rejects arbitrary NPCs and safely restores old or invalid preferences", () => {
    expect(isPlayerModel("chicken")).toBe(false);
    const p = createPlayer(0, 0);
    applyPlayerModel(p, "character-bear-v1");
    applyPlayerModel(p, "missing");
    expect(p.sprite?.sheetKey).toBe("player");
  });
});
