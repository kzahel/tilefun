import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { TerrainId } from "../autotile/TerrainId.js";
import { RemoteStateView } from "../client/ClientStateView.js";
import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import {
  decodeClientMessage,
  decodeServerMessage,
  encodeClientMessage,
} from "../shared/binaryCodec.js";
import type { ClientMessage } from "../shared/protocol.js";
import { World } from "../world/World.js";
import { DEER_TYPE } from "./Deer.js";
import { FAUNA_PROFILES, faunaType } from "./Fauna.js";
import { FROG_TYPE } from "./Frog.js";
import { RABBIT_TYPE } from "./Rabbit.js";
import { ROBIN_TYPE } from "./Robin.js";

// Collision primitives already have an exhaustive suite in FaunaBodies. This
// closes the separate edit-spawn -> throw command -> production Realm -> binary
// replica -> recovery path formerly repeated in 157 browser cases.
const subjects = [
  ...FAUNA_PROFILES.map((p) => ({
    species: p.species,
    type: faunaType(p.species),
    aquatic: p.habitat === "pond" || p.habitat === "deep",
    airborne: !!p.hop,
    escapeClips: p.clips.flatMap((c, i) => (c.name.startsWith("flee") ? [i] : [])),
  })),
  { species: "deer", type: DEER_TYPE, aquatic: false, airborne: false, escapeClips: [3] },
  { species: "frog", type: FROG_TYPE, aquatic: false, airborne: true, escapeClips: [1] },
  { species: "rabbit", type: RABBIT_TYPE, aquatic: false, airborne: true, escapeClips: [1] },
  { species: "robin", type: ROBIN_TYPE, aquatic: false, airborne: true, escapeClips: [2] },
];

it.each(subjects)(
  "$species survives a real ball command, replicates escape and recovers",
  async (p) => {
    const session = await ScenarioSession.create({
      version: 1,
      id: `ball-command-${p.species}`,
      generation: FLAT_SCENARIO,
      player: createPlayer(64, 64),
      props: [],
    });
    try {
      const send = (message: ClientMessage) =>
        session.realm.handleMessage(
          session.player.clientId,
          session.player,
          decodeClientMessage(encodeClientMessage(message)),
        );
      session.player.editorEnabled = true;
      if (p.aquatic)
        for (let y = -8; y <= 20; y++)
          for (let x = 7; x <= 28; x++)
            send({
              type: "edit-terrain-tile",
              tx: x,
              ty: y,
              terrainId: TerrainId.DeepWater,
              paintMode: "positive",
              bridgeDepth: 0,
            });
      send({ type: "edit-spawn", entityType: p.type, wx: 64 + (p.aquatic ? 75 : 100), wy: 64 });
      session.player.editorEnabled = false;
      await session.ready();
      const animal = required(session.realm.entityManager.entities.find((e) => e.type === p.type));
      const replica = new RemoteStateView(new World());
      const observe = () => {
        for (const packet of session.frames()) {
          const message = decodeServerMessage(packet);
          if (message.type === "frame" || message.type.startsWith("sync-"))
            replica.applyMessage(message as Parameters<RemoteStateView["applyMessage"]>[0]);
        }
        return required(replica.entities.find((e) => e.type === p.type));
      };
      expect(observe()).not.toBe(animal);
      let scared = false;
      let sawEscape = false;
      let ricochet = false;
      let recovered = false;
      for (let tick = 0; tick < 1200; tick++) {
        if (!scared && tick % 12 === 0) {
          send({
            type: "throw-ball",
            dirX: animal.position.wx - session.player.player.position.wx,
            dirY: animal.position.wy - session.player.player.position.wy,
            force: 0,
          });
        }
        // Explicit fixed stepping runs the real authority without wall-clock waits.
        session.tick(1 / 60);
        const live = observe();
        scared ||= live.wanderAI?.state === "scared";
        ricochet ||= session.realm.entityManager.entities.some(
          (e) => e.type === "ball" && (e.velocity?.vx ?? 0) < -1,
        );
        if (live.wanderAI?.state === "scared" && p.escapeClips.includes(live.sprite?.clip ?? -1)) {
          sawEscape ||= p.airborne ? (live.wz ?? 0) > 2 : (live.wz ?? 0) === 0;
        }
        expect(animal.deathTimer).toBeUndefined();
        if (sawEscape && live.wanderAI?.state !== "scared") {
          recovered = true;
          break;
        }
      }
      expect(scared).toBe(true);
      expect(ricochet).toBe(true);
      expect(sawEscape).toBe(true);
      expect(recovered).toBe(true);
      expect(session.realm.entityManager.byId.get(animal.id)).toBe(animal);
      expect(replica.entities.some((e) => e.id === animal.id)).toBe(true);
      expect(session.player.player.velocity).toEqual({ vx: 0, vy: 0 });
    } finally {
      await session.close();
    }
  },
);
