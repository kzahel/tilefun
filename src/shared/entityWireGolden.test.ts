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
  "baseline:minimal": "bafed058c4a85c6b32a9892c",
  "baseline:core": "f1d05cfef6e01314c238fd7c",
  "baseline:sprite-bare": "60e311c589f17db0d68d7bcc",
  "baseline:sprite-duration": "58aa00d12a589795ec7fe787",
  "baseline:sprite-model": "fcebc3021a73ce5c101115eb",
  "baseline:sprite-clip": "4d7d550d1344c64039f39048",
  "baseline:sprite-elapsed": "a74ea5275adb5a58f35b9403",
  "baseline:wander-befriend-false": "801ffe5717fe7fc59e800051",
  "baseline:wander-unknown-state": "f53eb01ad444743ae8d1557d",
  "baseline:velocity-zero": "f5d09c62d69911a75c2ed3d4",
  "baseline:all-ordinary": "e4b1a395689b5ea3936dc472",
  "baseline:all-edge": "60694e545e81a8afc9eac6dc",
  "baseline:only-flashHidden-a": "2c9cfa929378db72a407535e",
  "baseline:only-flashHidden-b": "4a646af13ad29ea135fdca68",
  "baseline:only-noShadow-a": "db1d63c8a9523d7f97b77670",
  "baseline:only-noShadow-b": "2dcc5a29e8e652d80db88ecd",
  "baseline:only-deathTimer-a": "cbc8c0feeb4d0e11fb9e6866",
  "baseline:only-deathTimer-b": "de2838d85d7724e4bd5664a8",
  "baseline:only-jumpZ-a": "d8508a881e7079d70ab4695c",
  "baseline:only-jumpZ-b": "bc772e96ad89a9509c0fa53e",
  "baseline:only-jumpVZ-a": "f0db4b0047eeda6b21ff455b",
  "baseline:only-jumpVZ-b": "f94c28abf27c69e87a66abfd",
  "baseline:only-wz-a": "9de6cf29de6ee08968d0a5c2",
  "baseline:only-wz-b": "2637cd55162a0cc9397a210e",
  "baseline:only-parentId-a": "960da649c9fb0a3621f6a4a7",
  "baseline:only-parentId-b": "5030352400e037bfcf72d734",
  "baseline:only-localOffsetX-a": "c2aab8834f0bd3ca1e5e9ffc",
  "baseline:only-localOffsetX-b": "10cffea560b0f462e219fa58",
  "baseline:only-localOffsetY-a": "93059f73ece963ea08d811ce",
  "baseline:only-localOffsetY-b": "3389102215e5faa74e26ac14",
  "baseline:only-jumpInputState-a": "77f248834959dab57ea091dc",
  "baseline:only-jumpInputState-b": "b45637bb2bb171bb189e4964",
  "baseline:only-emergencyState-a": "abb9c151bef9af7da26f3477",
  "baseline:only-emergencyState-b": "3fc36052dfba5d7b386cae15",
  "baseline:only-vehicleHeading-a": "ed3ef26e25459883e1d99ca5",
  "baseline:only-vehicleHeading-b": "98e779ad3241ffbc275981f7",
  "baseline:only-paintSchemeId-a": "be09ac4feecd44b3c590b992",
  "baseline:only-paintSchemeId-b": "357386742776a10b5314a69f",
  "baseline:only-bodyRotation-a": "8ef4443c3b53b8c963b466bc",
  "baseline:only-bodyRotation-b": "5cfcb8ee8fe29006a9029a79",
  "baseline:only-physicsGroupId-a": "bb121d117240988e77228e92",
  "baseline:only-physicsGroupId-b": "288cdf5ec5961fbd6bf7dc69",
  "delta:empty": "b3ca596c79602275a11c7f0c",
  "delta:position": "828340890709cb6f49585fb1",
  "delta:velocity-set": "58312ae9819d6c51292d287a",
  "delta:velocity-null": "8db716f2f791636612920f7a",
  "delta:sprite-set": "07025d3bc5df9640dd6ba1f6",
  "delta:sprite-null": "ec198a60bf90cc21599999ba",
  "delta:wander-set": "7cc548685dc4f963e0c194a1",
  "delta:wander-null": "513e5da91474a72fd743db22",
  "delta:all-set": "bd1a90296e71bb686dc6ff01",
  "delta:all-edge": "3c8dc6dfdc53fae055bfbf17",
  "delta:all-null": "193d4e4d18e55155e3546692",
  "delta:mixed-null": "e2859ca925b89d347bc4f4f4",
  "delta:only-flashHidden-a": "0b2d7d00de4de975411548c5",
  "delta:only-flashHidden-b": "9a541ca5d2e625545af1d6d0",
  "delta:only-flashHidden-null": "80f7bd98978f70ddf9dc27e0",
  "delta:only-noShadow-a": "1bbf76de153ffc8f134e721b",
  "delta:only-noShadow-b": "c1be970fd835f02da5483a04",
  "delta:only-noShadow-null": "d74e0de38386a6dccfbbf53b",
  "delta:only-deathTimer-a": "91b01dc3d9729df8a4d7c8a4",
  "delta:only-deathTimer-b": "14a451eb338917138e92b37a",
  "delta:only-deathTimer-null": "46bdb242fecd691f784dbfc1",
  "delta:only-jumpZ-a": "303a1596acd7f9c85a1e4991",
  "delta:only-jumpZ-b": "8e8f472ee25b43ded60dd87d",
  "delta:only-jumpZ-null": "eb85c7bc364c443b570f120e",
  "delta:only-jumpVZ-a": "cc52b315d0b743fd0d8ef9bb",
  "delta:only-jumpVZ-b": "fa0f865623cf5523f7bb659b",
  "delta:only-jumpVZ-null": "512f48f0727ad5a3602cdd2e",
  "delta:only-wz-a": "0ec090aa62e4f2a4567587ca",
  "delta:only-wz-b": "2d9dc40836f364382f1ea328",
  "delta:only-wz-null": "40a821f809113999ea4ab1b2",
  "delta:only-parentId-a": "a2f1de8e85100936693b70fb",
  "delta:only-parentId-b": "442f7f8c13705a9fafc60284",
  "delta:only-parentId-null": "0229952d5c1861a43df36d96",
  "delta:only-localOffsetX-a": "c3d405f4246740cdc6af187d",
  "delta:only-localOffsetX-b": "81a3dd35c0f954d7e0e4c605",
  "delta:only-localOffsetX-null": "ceb95c15dffa49cba3806de4",
  "delta:only-localOffsetY-a": "693c3aaff7b8b7be0fcce072",
  "delta:only-localOffsetY-b": "296908d8278bf376167699f8",
  "delta:only-localOffsetY-null": "1848c1fd342285131a0ca5e7",
  "delta:only-jumpInputState-a": "58304237d0f28f831e75f810",
  "delta:only-jumpInputState-b": "bea79ca2af5d82e7d6fad71b",
  "delta:only-jumpInputState-null": "7271bd96ae31cf4ab266ca45",
  "delta:only-emergencyState-a": "74914327144572e88cf7b887",
  "delta:only-emergencyState-b": "b9216a8016530d3ca8399a6c",
  "delta:only-emergencyState-null": "56dc12cf527d6df1e1e6578d",
  "delta:only-vehicleHeading-a": "213978dbbc7b271aa690fad0",
  "delta:only-vehicleHeading-b": "1d9a470a8064cc9399251ae8",
  "delta:only-vehicleHeading-null": "212359010acea7db09d6204f",
  "delta:only-paintSchemeId-a": "b68cd33a7aa2074ed108eef7",
  "delta:only-paintSchemeId-b": "c6ad5041ca4e0ef32460cb9d",
  "delta:only-paintSchemeId-null": "9982dc1e394e37e6d10f9921",
  "delta:only-bodyRotation-a": "1e24bd47f7d14cbf46b26c96",
  "delta:only-bodyRotation-b": "c6e7d6dd395ebe90490285cf",
  "delta:only-bodyRotation-null": "6aa5cf87ea9fcb5c8c80f4cf",
  "delta:only-physicsGroupId-a": "be1ba11569cc420669173d8c",
  "delta:only-physicsGroupId-b": "75c005fc21d0ccc6bf123984",
  "delta:only-physicsGroupId-null": "12c3a4d0b3a2ef1fcdbbd1a5",
  "frame:combined": "fd81ef8197500bbaac0a2c69",
  "serialize:plain": "583597858fe98592ccf980f1",
  "serialize:decorated": "a830dd95882b34bbff51d6a1",
  "serialize:moved": "8f193ada4f9f285211026729",
  "diff:plain->plain": "none",
  "apply:plain->plain": "583597858fe98592ccf980f1",
  "diff:plain->decorated": "ca6f2d6fe6d8626056dcd335",
  "apply:plain->decorated": "a830dd95882b34bbff51d6a1",
  "diff:plain->moved": "90458bd044a179aac68c1f32",
  "apply:plain->moved": "8f193ada4f9f285211026729",
  "diff:decorated->plain": "614beb1ca694847ac55a61f7",
  "apply:decorated->plain": "583597858fe98592ccf980f1",
  "diff:decorated->decorated": "none",
  "apply:decorated->decorated": "a830dd95882b34bbff51d6a1",
  "diff:decorated->moved": "827f3ade0bbaaf4c38a32e44",
  "apply:decorated->moved": "8f193ada4f9f285211026729",
  "diff:moved->plain": "da2b1f50b7d6fd2b603eee44",
  "apply:moved->plain": "583597858fe98592ccf980f1",
  "diff:moved->decorated": "f9a65ca001f7fb81e0b963f8",
  "apply:moved->decorated": "a830dd95882b34bbff51d6a1",
  "diff:moved->moved": "none",
  "apply:moved->moved": "8f193ada4f9f285211026729",
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
    expect(digest(new TextEncoder().encode(shape).buffer)).toBe("d13734234c951418b9846ba1");
  });
});
