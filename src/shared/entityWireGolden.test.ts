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
  ["towTargetId", 11, 4294967295],
  ["towedBy", 12, 0],
  ["vehicleRamp", 1, 0],
  ["transportLoadId", 13, 4294967295],
  ["transportedBy", 14, 0],
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
    towTargetId: 21,
    vehicleRamp: 1,
    transportedBy: 22,
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
  "baseline:minimal": "bcc0edbc3c72e67fd78a6889",
  "baseline:core": "dd740b8b38a7ab8a2d155cde",
  "baseline:sprite-bare": "6298d880cddc647c876536a8",
  "baseline:sprite-duration": "c6be05e61b9ca674839e6f00",
  "baseline:sprite-model": "f854ea3a674feec367109a1d",
  "baseline:sprite-clip": "cc08aadff1a0da8a4d2dc3cb",
  "baseline:sprite-elapsed": "6406ac42ef9a8c57009390d3",
  "baseline:wander-befriend-false": "1b37b836dce2a51902ceba27",
  "baseline:wander-unknown-state": "65d1209e21c0bb24ba7037e9",
  "baseline:velocity-zero": "f0d43ec32cc25e72dad0ab22",
  "baseline:all-ordinary": "8a96294f9bfe60cad9bc8f4e",
  "baseline:all-edge": "db536197b75b9fd5e499b738",
  "baseline:only-flashHidden-a": "166e9b30fe8f432993882654",
  "baseline:only-flashHidden-b": "cd3a60c594b53720be0b1ba6",
  "baseline:only-noShadow-a": "34dc953e1f01f57c9a7d2c5c",
  "baseline:only-noShadow-b": "128da2a7ce1fda0dccbcc8ef",
  "baseline:only-deathTimer-a": "2b021ab8d170a788df8c7e60",
  "baseline:only-deathTimer-b": "ef8535ceda34772f667c50bf",
  "baseline:only-jumpZ-a": "41e6cd86a028ff52cf6402d6",
  "baseline:only-jumpZ-b": "20736960aa3a866ede0d3bb3",
  "baseline:only-jumpVZ-a": "530fc27a0cd08a0ee4ba7033",
  "baseline:only-jumpVZ-b": "5fdfbc1faaa6d3625a2afaed",
  "baseline:only-wz-a": "ce87ec2189ab521714fe0de0",
  "baseline:only-wz-b": "3f413a190603bc5ce3843f20",
  "baseline:only-parentId-a": "c786112924e96d0e57b656ea",
  "baseline:only-parentId-b": "8ecfab9d9360c5616facc083",
  "baseline:only-localOffsetX-a": "bce1ac489f9608af5c64664b",
  "baseline:only-localOffsetX-b": "366c52bbd12458e4eba75cc1",
  "baseline:only-localOffsetY-a": "ef78cc6309a97d2a085eeee1",
  "baseline:only-localOffsetY-b": "0e8b171e2900e0a70485dcf7",
  "baseline:only-jumpInputState-a": "054bb3107a3920ea25f99879",
  "baseline:only-jumpInputState-b": "e7e33abf3fdb186474222d5c",
  "baseline:only-emergencyState-a": "5528aa1ba1d2e5fbf49717a0",
  "baseline:only-emergencyState-b": "56993350700b398f582583b6",
  "baseline:only-vehicleHeading-a": "af9754df412c73aa9910d2bb",
  "baseline:only-vehicleHeading-b": "3cee7a52dbce786396389e79",
  "baseline:only-paintSchemeId-a": "3d1293c0ed5be016395855a6",
  "baseline:only-paintSchemeId-b": "ebaa93d653c6c5988a5c507c",
  "baseline:only-bodyRotation-a": "ca0112f5718efb98886ee073",
  "baseline:only-bodyRotation-b": "18c4e94a57592713de386147",
  "baseline:only-physicsGroupId-a": "aca5b3bed76822820b359775",
  "baseline:only-physicsGroupId-b": "e2b32cb7bc5256c73ebed395",
  "delta:empty": "35e49d5a383a348faa0aab78",
  "delta:position": "8a0bb9fb1341e105a42d7af4",
  "delta:velocity-set": "0f51e29b7d450e720e05fb2a",
  "delta:velocity-null": "a9b76a8a894273fa0d7ff590",
  "delta:sprite-set": "480c6e15b19e81a26d730ae6",
  "delta:sprite-null": "4b104054dd8f5b6445100458",
  "delta:wander-set": "327d333501b0a9b588f4b1b7",
  "delta:wander-null": "926c70dd67ae11aa955ea1ed",
  "delta:all-set": "232d42a3f248a1d6b5f0b34c",
  "delta:all-edge": "7361795698625ff143f39c0c",
  "delta:all-null": "e08e8cabcf19716c861796fe",
  "delta:mixed-null": "ac2f330d1a03c6b46a5f50da",
  "delta:only-flashHidden-a": "088584a32be06b38a86bfd27",
  "delta:only-flashHidden-b": "88d8e6f073f46ff5f0726e90",
  "delta:only-flashHidden-null": "1d1c8fb84f375c4e553b36e3",
  "delta:only-noShadow-a": "e411c096c8a26b598e59591c",
  "delta:only-noShadow-b": "75482197820aa7990ad88e9e",
  "delta:only-noShadow-null": "01b3a3d7bee47fcfdeb44a08",
  "delta:only-deathTimer-a": "f0c78e2f4d770d41a45e8742",
  "delta:only-deathTimer-b": "c342bafaabdc7521d6985461",
  "delta:only-deathTimer-null": "453bd9e3e6e957d57a0d5a13",
  "delta:only-jumpZ-a": "edb2eb83774afced4d46d454",
  "delta:only-jumpZ-b": "61a4065354993207c85c8e6a",
  "delta:only-jumpZ-null": "d4fde328d6520890aac25c92",
  "delta:only-jumpVZ-a": "9e3fd9362cf085eebfc90abb",
  "delta:only-jumpVZ-b": "d00aa609b7ac0a74239b21d3",
  "delta:only-jumpVZ-null": "055056d3a35a8a59dd763c7c",
  "delta:only-wz-a": "dfb543cec9196f41ee4d45b4",
  "delta:only-wz-b": "90b1de99d9a4eec5655359d5",
  "delta:only-wz-null": "d6958f491640396ffdef45f7",
  "delta:only-parentId-a": "dadc3d0e27249325a7e5a87e",
  "delta:only-parentId-b": "dc1e3410113edc49d8e571bc",
  "delta:only-parentId-null": "2b2d94a78170fcbde20ba587",
  "delta:only-localOffsetX-a": "f545bb8f70341e43ce0643fe",
  "delta:only-localOffsetX-b": "a0c7922a9176adcb5cd0f65d",
  "delta:only-localOffsetX-null": "98c0d0719b9d810518e043c5",
  "delta:only-localOffsetY-a": "cb04c5882710d92a19c4b91b",
  "delta:only-localOffsetY-b": "5d5e428017661c43f00e24d9",
  "delta:only-localOffsetY-null": "404508164877f9f35d6d7939",
  "delta:only-jumpInputState-a": "c947de531c77756f1876b911",
  "delta:only-jumpInputState-b": "41698d95a5c913cf8fbdafd0",
  "delta:only-jumpInputState-null": "61b6f46cb1b2daf5d99e7efe",
  "delta:only-emergencyState-a": "a6cb97f91cbe3e5ee09df380",
  "delta:only-emergencyState-b": "d7ca0bd37dba038abfeabe4d",
  "delta:only-emergencyState-null": "d63bcacab83d60d06054802d",
  "delta:only-vehicleHeading-a": "18b1b57216274ce386022da2",
  "delta:only-vehicleHeading-b": "e152cef8fefa66a39e2231a6",
  "delta:only-vehicleHeading-null": "a1ce1792d7f0e43ce94aff78",
  "delta:only-paintSchemeId-a": "6bdddaa85852d8e93b51c7bd",
  "delta:only-paintSchemeId-b": "0362123928a3e37abc9a89ee",
  "delta:only-paintSchemeId-null": "446c8407ebff7eab3407ad2d",
  "delta:only-bodyRotation-a": "05fbd2907bb7e196b319a10c",
  "delta:only-bodyRotation-b": "e487f001073b8897916c0b88",
  "delta:only-bodyRotation-null": "272f8c54520c6ff1b1d7405c",
  "delta:only-physicsGroupId-a": "8308fedd3f513a2dfd2c5c69",
  "delta:only-physicsGroupId-b": "d898144f5bc7a679c2e5c1e4",
  "delta:only-physicsGroupId-null": "f79b2088c8dba4b875d5caa3",
  "frame:combined": "6fc8754f895bdc09f0a671f5",
  "serialize:plain": "8c741873027405b546bfc910",
  "serialize:decorated": "d64375bfc1c7bd3bd4a32f6f",
  "serialize:moved": "8cb4392f03ee2aec294f3368",
  "diff:plain->plain": "none",
  "apply:plain->plain": "8c741873027405b546bfc910",
  "diff:plain->decorated": "9784593a8a44ab0334b61992",
  "apply:plain->decorated": "d64375bfc1c7bd3bd4a32f6f",
  "diff:plain->moved": "3554115ad03cd1a3d5cfc23d",
  "apply:plain->moved": "8cb4392f03ee2aec294f3368",
  "diff:decorated->plain": "1886c70b58fd8d6892496329",
  "apply:decorated->plain": "8c741873027405b546bfc910",
  "diff:decorated->decorated": "none",
  "apply:decorated->decorated": "d64375bfc1c7bd3bd4a32f6f",
  "diff:decorated->moved": "93b1191468cc7f60e441513e",
  "apply:decorated->moved": "8cb4392f03ee2aec294f3368",
  "diff:moved->plain": "83064e3d9cad71ac9413b28f",
  "apply:moved->plain": "8c741873027405b546bfc910",
  "diff:moved->decorated": "c940ff6bf5bf0fd9fb01ba9b",
  "apply:moved->decorated": "d64375bfc1c7bd3bd4a32f6f",
  "diff:moved->moved": "none",
  "apply:moved->moved": "8cb4392f03ee2aec294f3368",
  "baseline:only-vehicleBedTarget-a": "f97fc3e08587d8a578580b3d",
  "baseline:only-vehicleBedTarget-b": "d740c17c6137683101ffe00c",
  "baseline:only-vehicleBedTilt-a": "56c01dfff30f1edd07ce9051",
  "baseline:only-vehicleBedTilt-b": "41f18adac672bd3afb35e3ca",
  "delta:only-vehicleBedTarget-a": "f58f94543f778edce3386e48",
  "delta:only-vehicleBedTarget-b": "f017e431dbb685c6a2b838ce",
  "delta:only-vehicleBedTarget-null": "1f634d5e0a108c8c17144e88",
  "delta:only-vehicleBedTilt-a": "8e6e3be0ae694823ed499c68",
  "delta:only-vehicleBedTilt-b": "70e3da142450dc3bba211972",
  "delta:only-vehicleBedTilt-null": "148898c7c6d7d24755f4b5c8",
  "baseline:only-towTargetId-a": "f288cabc1a3065032ab2ba2e",
  "baseline:only-towTargetId-b": "5d1cb0706ef1ffc64db2a7e6",
  "baseline:only-towedBy-a": "77a26eb51f5cfd5e72d8e8b7",
  "baseline:only-towedBy-b": "1f187959d8b74f86af2ea25e",
  "baseline:only-transportLoadId-a": "8b48f4484944546dc0368ee7",
  "baseline:only-transportLoadId-b": "4dd7263c94cf0f21823ee329",
  "baseline:only-transportedBy-a": "f1dc29c9a7933fe5c7d8dc95",
  "baseline:only-transportedBy-b": "6024f1f7482daf2840437342",
  "baseline:only-vehicleRamp-a": "a42839694fc25c3d38d6e684",
  "baseline:only-vehicleRamp-b": "f687d062723f97584fc57b1d",
  "delta:only-towTargetId-a": "954ac281e59c163060b23e64",
  "delta:only-towTargetId-b": "c1cdefe9077a3ba168ba177f",
  "delta:only-towTargetId-null": "422a079c03cb561d991e95ee",
  "delta:only-towedBy-a": "99be322259e893e2600f0cb2",
  "delta:only-towedBy-b": "68aabd12262abe71a66ab8df",
  "delta:only-towedBy-null": "8190d97227516b739bcb3bd1",
  "delta:only-transportLoadId-a": "555d3d0659f933af837f6965",
  "delta:only-transportLoadId-b": "5273698915e8fcfac40911e5",
  "delta:only-transportLoadId-null": "057416c931fabe1acdc469aa",
  "delta:only-transportedBy-a": "0a777ab205f18da20661f9f0",
  "delta:only-transportedBy-b": "58718b2da642fa9fd071aa75",
  "delta:only-transportedBy-null": "1ee4d02113c92fb3e6e8890f",
  "delta:only-vehicleRamp-a": "bf66be0c7931ce06222fa5c2",
  "delta:only-vehicleRamp-b": "3cd7faa617af0c3cc59dd31a",
  "delta:only-vehicleRamp-null": "26420e35a470075f65fe12d2",
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
    expect(digest(new TextEncoder().encode(shape).buffer)).toBe("f40e3cf90c30c85bc2384869");
  });
});
