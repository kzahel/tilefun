/**
 * Golden wire bytes for entity baselines and deltas.
 *
 * The digests were captured from the hand-written codec before the
 * `ENTITY_FIELDS` schema replaced it. Any change here is a wire-format change:
 * do not update a digest without also bumping the protocol and shipping
 * matching client and server builds.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Entity } from "../entities/Entity.js";
import { Direction } from "../entities/Entity.js";
import { decodeServerMessage, encodeServerMessage } from "./binaryCodec.js";
import { applyEntityDelta, diffEntitySnapshots, type EntityDelta } from "./entityDelta.js";
import type { EntitySnapshot, FrameMessage } from "./protocol.js";
import { deserializeEntity, serializeEntity } from "./serialization.js";

// An unregistered type always encodes as index 0, so concurrent entity
// registry additions cannot move these digests.
const TYPE = "golden-unregistered";

const FULL_SPRITE = {
  direction: Direction.Left,
  moving: true,
  frameRow: 255,
  flipX: true,
  frameDuration: 65535,
  model: "person1",
  clip: 7,
  clipElapsedMs: 1234,
};

/** Optional scalar fields with ordinary, then edge, values. */
const OPTIONAL_VALUES: readonly (readonly [keyof EntitySnapshot, unknown, unknown])[] = [
  ["flashHidden", true, false],
  ["noShadow", false, true],
  ["deathTimer", 1.5, 0.1],
  ["jumpZ", 12.25, -0],
  ["jumpVZ", -48, Number.POSITIVE_INFINITY],
  ["wz", 3.75, 1e-40],
  ["parentId", 7, 4294967295],
  ["localOffsetX", -16.5, 16777217],
  ["localOffsetY", 8, Number.NaN],
  ["jumpInputState", 3, 0],
  ["emergencyState", 5, 255],
  ["vehicleHeading", Math.PI, -Math.PI / 3],
  ["paintSchemeId", "teal", "butter"],
  ["bodyRotation", [0, 0, 0, 1], [0.1, -0.2, 0.3, -0.9]],
  ["physicsGroupId", 9, 0],
  ["vehicleBedTilt", 0.5, 0.8377580642700195],
  ["vehicleBedTarget", 0.8377580642700195, 0],
];

function baseline(extra: Partial<EntitySnapshot> = {}): EntitySnapshot {
  return {
    id: 1,
    type: TYPE,
    position: { wx: 100.5, wy: -200.25 },
    velocity: null,
    spriteState: null,
    wanderAIState: null,
    ...extra,
  };
}

function withOptionals(pick: 1 | 2): Partial<EntitySnapshot> {
  return Object.fromEntries(OPTIONAL_VALUES.map((entry) => [entry[0], entry[pick]]));
}

function baselineCases(): Record<string, EntitySnapshot> {
  const cases: Record<string, EntitySnapshot> = {
    minimal: baseline(),
    core: baseline({
      velocity: { vx: 1.25, vy: -3 },
      spriteState: { ...FULL_SPRITE },
      wanderAIState: { state: "scared", dirX: -1, dirY: 1, following: true, befriendable: true },
    }),
    "sprite-bare": baseline({
      spriteState: { direction: Direction.Up, moving: false, frameRow: 0 },
    }),
    "sprite-duration": baseline({
      spriteState: { direction: Direction.Right, moving: false, frameRow: 3, frameDuration: 90 },
    }),
    "sprite-model": baseline({
      spriteState: { direction: Direction.Down, moving: true, frameRow: 1, model: "player" },
    }),
    "sprite-clip": baseline({
      spriteState: { direction: Direction.Down, moving: false, frameRow: 2, clip: 0 },
    }),
    "sprite-elapsed": baseline({
      spriteState: { direction: Direction.Up, moving: false, frameRow: 2, clipElapsedMs: 0 },
    }),
    "wander-befriend-false": baseline({
      wanderAIState: { state: "idle", dirX: 0, dirY: 0, befriendable: false },
    }),
    "wander-unknown-state": baseline({
      wanderAIState: { state: "mystery", dirX: 127, dirY: -128 },
    }),
    "velocity-zero": baseline({ velocity: { vx: -0, vy: 0 } }),
    "all-ordinary": baseline({
      velocity: { vx: 2, vy: 4 },
      spriteState: { ...FULL_SPRITE },
      wanderAIState: { state: "ridden", dirX: 1, dirY: 0 },
      ...withOptionals(1),
    }),
    "all-edge": baseline({
      id: 4294967295,
      position: { wx: 1e-45, wy: 3.5e38 },
      ...withOptionals(2),
    }),
  };
  for (const [key, a, b] of OPTIONAL_VALUES) {
    cases[`only-${key}-a`] = baseline({ [key]: a });
    cases[`only-${key}-b`] = baseline({ [key]: b });
  }
  return cases;
}

function deltaCases(): Record<string, EntityDelta> {
  const allSet: EntityDelta = {
    id: 3,
    position: { wx: 1, wy: 2 },
    velocity: { vx: -5, vy: 0.5 },
    spriteState: { ...FULL_SPRITE },
    wanderAIState: { state: "following", dirX: 0, dirY: -1, befriendable: true },
    ...withOptionals(1),
  };
  const allNull: EntityDelta = {
    id: 4,
    velocity: null,
    spriteState: null,
    wanderAIState: null,
    ...Object.fromEntries(OPTIONAL_VALUES.map(([key]) => [key, null])),
  };
  const cases: Record<string, EntityDelta> = {
    empty: { id: 2 },
    position: { id: 2, position: { wx: -0.5, wy: 65536.125 } },
    "velocity-set": { id: 2, velocity: { vx: 1, vy: 2 } },
    "velocity-null": { id: 2, velocity: null },
    "sprite-set": { id: 2, spriteState: { direction: Direction.Up, moving: true, frameRow: 9 } },
    "sprite-null": { id: 2, spriteState: null },
    "wander-set": { id: 2, wanderAIState: { state: "walking", dirX: 1, dirY: 1 } },
    "wander-null": { id: 2, wanderAIState: null },
    "all-set": allSet,
    "all-edge": { id: 5, ...withOptionals(2) },
    "all-null": allNull,
    "mixed-null": {
      id: 6,
      position: { wx: 3, wy: 4 },
      velocity: null,
      spriteState: { direction: Direction.Left, moving: false, frameRow: 4, clip: 2 },
      flashHidden: null,
      deathTimer: 0.25,
      paintSchemeId: null,
      bodyRotation: [1, 0, 0, 0],
      physicsGroupId: null,
      localOffsetY: -1,
    },
  };
  for (const [key, a, b] of OPTIONAL_VALUES) {
    cases[`only-${key}-a`] = { id: 7, [key]: a };
    cases[`only-${key}-b`] = { id: 7, [key]: b };
    cases[`only-${key}-null`] = { id: 7, [key]: null };
  }
  return cases;
}

function frame(extra: Partial<FrameMessage>): FrameMessage {
  return { type: "frame", serverTick: 77, lastProcessedInputSeq: 5, playerEntityId: 1, ...extra };
}

function digest(bytes: ArrayBuffer): string {
  return createHash("sha256").update(new Uint8Array(bytes)).digest("hex").slice(0, 24);
}

function encodedDigests(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, snap] of Object.entries(baselineCases()))
    out[`baseline:${name}`] = digest(encodeServerMessage(frame({ entityBaselines: [snap] })));
  for (const [name, delta] of Object.entries(deltaCases()))
    out[`delta:${name}`] = digest(encodeServerMessage(frame({ entityDeltas: [delta] })));
  out["frame:combined"] = digest(
    encodeServerMessage(
      frame({
        simulationTime: 12.5,
        entityBaselines: Object.values(baselineCases()),
        entityDeltas: Object.values(deltaCases()),
        entityExits: [9, 4294967295],
      }),
    ),
  );
  return out;
}

// ---- Semantic path: serialize → diff → apply, pinned through the wire ----

function entity(extra: Partial<Entity> = {}): Entity {
  return {
    id: 11,
    type: "chicken",
    position: { wx: 40, wy: 60 },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      sheetKey: "chicken",
      spriteWidth: 16,
      spriteHeight: 16,
      frameCount: 4,
      frameDuration: 123,
      frameCol: 0,
      frameRow: 1,
      animTimer: 0,
      direction: Direction.Down,
      moving: false,
    },
    collider: null,
    wanderAI: null,
    ...extra,
  };
}

const ENTITY_STATES: Record<string, Partial<Entity>> = {
  plain: {},
  decorated: {
    flashHidden: true,
    noShadow: true,
    deathTimer: 2,
    jumpZ: 4,
    jumpVZ: -1,
    wz: 6,
    parentId: 3,
    localOffsetX: 1,
    localOffsetY: -2,
    jumpInputState: 1,
    emergencyState: 2,
    vehicleHeading: 0.5,
    paintSchemeId: "cherry",
    bodyRotation: [0, 0, 0.5, 0.5],
    physicsGroupId: 12,
    vehicleBedTilt: 0.25,
    vehicleBedTarget: 0.75,
  },
  moved: {
    position: { wx: 41, wy: 59 },
    velocity: null,
    flashHidden: false,
    deathTimer: 1,
    bodyRotation: [0, 0, 0.6, 0.4],
    wz: 6,
  },
};

function semanticDigests(): Record<string, string> {
  const out: Record<string, string> = {};
  const snaps = Object.fromEntries(
    Object.entries(ENTITY_STATES).map(([name, extra]) => [name, serializeEntity(entity(extra))]),
  );
  const forWire = (s: EntitySnapshot): EntitySnapshot => ({ ...s, type: TYPE });
  for (const [name, snap] of Object.entries(snaps))
    out[`serialize:${name}`] = digest(
      encodeServerMessage(frame({ entityBaselines: [forWire(snap)] })),
    );
  for (const [from, a] of Object.entries(snaps))
    for (const [to, b] of Object.entries(snaps)) {
      const delta = diffEntitySnapshots(a, b);
      out[`diff:${from}->${to}`] = delta
        ? digest(encodeServerMessage(frame({ entityDeltas: [delta] })))
        : "none";
      const target = deserializeEntity(a);
      if (delta) applyEntityDelta(target, delta);
      out[`apply:${from}->${to}`] = digest(
        encodeServerMessage(frame({ entityBaselines: [forWire(serializeEntity(target))] })),
      );
    }
  return out;
}

const EXPECTED: Record<string, string> = {
  "baseline:minimal": "7d54506e8acaa7d0c4092e12",
  "baseline:core": "1d5dd7ae6a7edb3bf996dd86",
  "baseline:sprite-bare": "b97e9e553272208295f45649",
  "baseline:sprite-duration": "03361ab447f834fd30ff33bb",
  "baseline:sprite-model": "974aa043fc802fb1c713d1ea",
  "baseline:sprite-clip": "373e9739493df3dc62d03626",
  "baseline:sprite-elapsed": "bc0599f4e4935afba01f6385",
  "baseline:wander-befriend-false": "8b98f5c1eb34c51ca495febd",
  "baseline:wander-unknown-state": "35f91b4fc816fce6ce5e2791",
  "baseline:velocity-zero": "bf24c214b1a76cf6b57a7414",
  "baseline:all-ordinary": "d2f7dbb844784333d3695d7f",
  "baseline:all-edge": "2603b891aad6220c1e2d84f8",
  "baseline:only-flashHidden-a": "34914f143c04c83d1ebeebcd",
  "baseline:only-flashHidden-b": "e3a949852a1d7d71438baf0c",
  "baseline:only-noShadow-a": "83d9901e4dab6b6ab9e3f1ee",
  "baseline:only-noShadow-b": "d99d3d6fe2547cb5aae4c6a9",
  "baseline:only-deathTimer-a": "7d076a5175f7c4834902333e",
  "baseline:only-deathTimer-b": "d8fb60878718a24e771277e2",
  "baseline:only-jumpZ-a": "05e0d2c140c7cabef878ef0a",
  "baseline:only-jumpZ-b": "786a383325ca0696fa4b3ed0",
  "baseline:only-jumpVZ-a": "14e79f8c741ed085ee1066ae",
  "baseline:only-jumpVZ-b": "2f5cb17e232568a5948b20a1",
  "baseline:only-wz-a": "f1584718c0c4bf6198d6bc41",
  "baseline:only-wz-b": "7b781eae0cd5171f2a988bcd",
  "baseline:only-parentId-a": "293fe2e813ea3dfe059d1ed7",
  "baseline:only-parentId-b": "f4b6a1a94afe3f735aa22dca",
  "baseline:only-localOffsetX-a": "6591025f7cff0bc9defb5d6e",
  "baseline:only-localOffsetX-b": "a3c7158a563dcf9869d264bb",
  "baseline:only-localOffsetY-a": "21d737243583e0a128bed0f1",
  "baseline:only-localOffsetY-b": "565f65cd8c04346f199587b5",
  "baseline:only-jumpInputState-a": "3dc2e433e44c7c5c2500f8f7",
  "baseline:only-jumpInputState-b": "3deee403af7a1afed42cc0e4",
  "baseline:only-emergencyState-a": "5db0993dd3f5e283f51a06b1",
  "baseline:only-emergencyState-b": "c671e83b4bad7c47c91ac202",
  "baseline:only-vehicleHeading-a": "987c457f9ebf1450e9d9f25b",
  "baseline:only-vehicleHeading-b": "61a35c1ce1bc38f9cf50df3d",
  "baseline:only-paintSchemeId-a": "9015e52f0408f871bf7524be",
  "baseline:only-paintSchemeId-b": "f3a642905ef7fa88924169a9",
  "baseline:only-bodyRotation-a": "39fd129aa7e4a64b7dab12e8",
  "baseline:only-bodyRotation-b": "dd53c2d281840cd2a2081ce9",
  "baseline:only-physicsGroupId-a": "27cf3b1d01c80766fecf2313",
  "baseline:only-physicsGroupId-b": "311421cab0bab8e27e01c82d",
  "delta:empty": "1be71fc20fdf55db02cc4300",
  "delta:position": "4af0739e8e7ff2ae27341c1c",
  "delta:velocity-set": "93a3d45387c03ca9ea522b92",
  "delta:velocity-null": "e25f6b5659f01b39f3f43d97",
  "delta:sprite-set": "90aa3a0e91a3a2deb5a502ed",
  "delta:sprite-null": "1295e059a845c4da3bd2da48",
  "delta:wander-set": "0e1a22a298cd5aae58cff1f2",
  "delta:wander-null": "ed2f3a723e72e5ec34b7e1ca",
  "delta:all-set": "a870abab831fbb1384df9112",
  "delta:all-edge": "fe95d2ef91e9ae7744aff0d5",
  "delta:all-null": "c85de6e291b95ed367d142a0",
  "delta:mixed-null": "82888c07b1e536040707eec0",
  "delta:only-flashHidden-a": "432fad3c1383f38aceaf90b9",
  "delta:only-flashHidden-b": "59d932c59653c27e95182595",
  "delta:only-flashHidden-null": "87f0d23b67010cd7883fb278",
  "delta:only-noShadow-a": "49508557f0c8598f59ba05bb",
  "delta:only-noShadow-b": "9e9e3eb4cd1c23f3d1b07cf5",
  "delta:only-noShadow-null": "e4570551d2852198b02a3aea",
  "delta:only-deathTimer-a": "62612bd616f19760d0a5c70c",
  "delta:only-deathTimer-b": "65a977ebe0aae9ac67a83813",
  "delta:only-deathTimer-null": "412260a384132bf7cf0e2f72",
  "delta:only-jumpZ-a": "0524e85e287ee591217636be",
  "delta:only-jumpZ-b": "91f069cb1c74314b5ac6454d",
  "delta:only-jumpZ-null": "8351388f6f2d8c7b7f728e05",
  "delta:only-jumpVZ-a": "5bfbc12b3376eebcc709522d",
  "delta:only-jumpVZ-b": "e90f5b699d71faffbf7648d0",
  "delta:only-jumpVZ-null": "ced34ca1143eeec15e1cabf7",
  "delta:only-wz-a": "c6b80961a582c57755a9f07b",
  "delta:only-wz-b": "a28ddbac296aadbf70e843f8",
  "delta:only-wz-null": "1997e38cec5ac235f4368b77",
  "delta:only-parentId-a": "eb10dc5f1a626358c257c273",
  "delta:only-parentId-b": "bede1bad9173648832d7dd9a",
  "delta:only-parentId-null": "ffcbbe915edd0c532ae3bb6c",
  "delta:only-localOffsetX-a": "14f4f4bbc3103e22f7cead7e",
  "delta:only-localOffsetX-b": "6d598f50600086c94304e36b",
  "delta:only-localOffsetX-null": "753b0b306f86e1d08a170d2e",
  "delta:only-localOffsetY-a": "87edb51600c52f53a1472607",
  "delta:only-localOffsetY-b": "c7c49bc04029a6186f746a95",
  "delta:only-localOffsetY-null": "ed89f0fb2f033d22acfbda6d",
  "delta:only-jumpInputState-a": "8092beb24adb8a86825a630f",
  "delta:only-jumpInputState-b": "a6c0c609eb996a062e6fc426",
  "delta:only-jumpInputState-null": "cdcea259de17bae5ca89bce9",
  "delta:only-emergencyState-a": "b116d33edba1e9735e77ba72",
  "delta:only-emergencyState-b": "3e12e0b5879924f3eb520a9d",
  "delta:only-emergencyState-null": "1e77474e14c09b089c7bb64b",
  "delta:only-vehicleHeading-a": "12e4d1876d89948e95cdb563",
  "delta:only-vehicleHeading-b": "d989f126ce4e1c834867a2e0",
  "delta:only-vehicleHeading-null": "d544f2f73140a66ce71d3646",
  "delta:only-paintSchemeId-a": "4c28a87a8bb1e49162c085eb",
  "delta:only-paintSchemeId-b": "ad17b8f8342a7b867a3d175a",
  "delta:only-paintSchemeId-null": "abda5bd665d1d7b4b495e297",
  "delta:only-bodyRotation-a": "85f632cca5b1bdb609defcb9",
  "delta:only-bodyRotation-b": "321030786c579d7082b95d6b",
  "delta:only-bodyRotation-null": "ee952f2e6c60cc929648ae89",
  "delta:only-physicsGroupId-a": "083dddc23bdaed4e14ce8c77",
  "delta:only-physicsGroupId-b": "a92a44d5d04404658db0301f",
  "delta:only-physicsGroupId-null": "3ba6d56c9f0a7fb349c9df37",
  "frame:combined": "07480e8cc13c35712f1919e4",
  "serialize:plain": "d7531ffe18e5e163ecce0699",
  "serialize:decorated": "5fc273da4a98c9b3cc954162",
  "serialize:moved": "80329ac4d2df82dd8fe1a648",
  "diff:plain->plain": "none",
  "apply:plain->plain": "d7531ffe18e5e163ecce0699",
  "diff:plain->decorated": "8e27eb30bb153d9034490937",
  "apply:plain->decorated": "5fc273da4a98c9b3cc954162",
  "diff:plain->moved": "578058c49594886503c4d9f6",
  "apply:plain->moved": "80329ac4d2df82dd8fe1a648",
  "diff:decorated->plain": "4a68dceb90b441da0dd326ef",
  "apply:decorated->plain": "d7531ffe18e5e163ecce0699",
  "diff:decorated->decorated": "none",
  "apply:decorated->decorated": "5fc273da4a98c9b3cc954162",
  "diff:decorated->moved": "8e64f04153c41ca849db2451",
  "apply:decorated->moved": "80329ac4d2df82dd8fe1a648",
  "diff:moved->plain": "35cabe7b9d0a5f2650772cd6",
  "apply:moved->plain": "d7531ffe18e5e163ecce0699",
  "diff:moved->decorated": "eef00a38ee2409d2a73c7f01",
  "apply:moved->decorated": "5fc273da4a98c9b3cc954162",
  "diff:moved->moved": "none",
  "apply:moved->moved": "80329ac4d2df82dd8fe1a648",
  "baseline:only-vehicleBedTarget-a": "6d40856b90a44eacab42bc06",
  "baseline:only-vehicleBedTarget-b": "485263568e1a93c4bc77dcdd",
  "baseline:only-vehicleBedTilt-a": "b82de4e35d4381f61c9d33c1",
  "baseline:only-vehicleBedTilt-b": "081f3dbe57d9a2f772d74861",
  "delta:only-vehicleBedTarget-a": "8e4dbb70f8848ea407c230b7",
  "delta:only-vehicleBedTarget-b": "b85d03c66c0e679d09780027",
  "delta:only-vehicleBedTarget-null": "e9e0dfa22e4ba860f4a22778",
  "delta:only-vehicleBedTilt-a": "0f5a33b6c4db9a88f6737854",
  "delta:only-vehicleBedTilt-b": "18b39fc6b7b6b6e6e2eb4efb",
  "delta:only-vehicleBedTilt-null": "43df55500bd9c7a10786f00f",
};

describe("entity wire golden bytes", () => {
  it("encodes baselines and deltas byte-identically", () => {
    expect(encodedDigests()).toEqual(
      Object.fromEntries(
        Object.entries(EXPECTED).filter(([k]) => /^(baseline|delta|frame):/.test(k)),
      ),
    );
  });

  it("serializes, diffs and applies to the same wire bytes", () => {
    expect(semanticDigests()).toEqual(
      Object.fromEntries(
        Object.entries(EXPECTED).filter(([k]) => /^(serialize|diff|apply):/.test(k)),
      ),
    );
  });

  it("re-encodes decoded frames to the same bytes", () => {
    const bytes = encodeServerMessage(
      frame({
        entityBaselines: Object.values(baselineCases()),
        entityDeltas: Object.values(deltaCases()),
      }),
    );
    expect(digest(encodeServerMessage(decodeServerMessage(bytes)))).toBe(digest(bytes));
  });

  it("decodes frames to the same object shape", () => {
    // Re-encoding cannot tell null from undefined (absent); pin the decoded shape too.
    const decoded = decodeServerMessage(
      encodeServerMessage(
        frame({
          entityBaselines: Object.values(baselineCases()),
          entityDeltas: Object.values(deltaCases()),
        }),
      ),
    );
    const shape = JSON.stringify(decoded, (_key, value: unknown) =>
      value === undefined ? "<undefined>" : value,
    );
    expect(digest(new TextEncoder().encode(shape).buffer)).toBe("8a02a6959562a026f3114619");
  });
});
