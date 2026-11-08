import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Entity } from "../entities/Entity.js";
import type { DoorMotion } from "../interiors/DoorTraversal.js";
import type { SceneItem } from "../rendering/SceneItem.js";
import { DoorPresentation } from "./DoorPresentation.js";

let veil: { style: Record<string, string>; dataset: Record<string, string>; remove: () => void };
beforeEach(() => {
  veil = { style: {}, dataset: {}, remove: vi.fn() };
  vi.stubGlobal("document", { createElement: () => veil, body: { append: vi.fn() } });
});
afterEach(() => vi.unstubAllGlobals());
const motion: DoorMotion = {
  type: "door-motion",
  phase: "depart",
  actorId: 1,
  actorClientId: "alice",
  realmId: "street",
  self: true,
  from: { wx: 100, wy: 120 },
  to: { wx: 100, wy: 104 },
  duration: 400,
  overlay: { wx: 100, wy: 96, kind: "butcher" },
};
it("waits behind the fade until the destination baseline is ready; timeout and cancel release controls", () => {
  const presentation = new DoorPresentation();
  presentation.receive(motion, 0);
  presentation.update("street", true, 580);
  expect(veil.style.opacity).toBe("1");
  presentation.receive({ ...motion, phase: "arrive", realmId: "room" }, 600);
  presentation.update("street", true, 700);
  expect(veil.style.opacity).toBe("1");
  presentation.update("room", false, 800);
  expect(presentation.busy).toBe(true);
  presentation.update("room", true, 900);
  presentation.update("room", true, 1100);
  expect(veil.style.opacity).toBe("0");
  presentation.update("room", true, 1500);
  expect(presentation.busy).toBe(false);
  presentation.begin(2000);
  presentation.update("room", false, 32001);
  expect(presentation.busy).toBe(false);
  presentation.receive(motion, 33000);
  presentation.cancel();
  expect(veil.style.opacity).toBe("0");
  expect(presentation.busy).toBe(false);
});
it("scopes cosmetic actors to a realm without mutating the authoritative entity", () => {
  const presentation = new DoorPresentation();
  const actor: Entity = {
    id: 1,
    type: "player",
    position: { ...motion.from },
    sprite: null,
    velocity: null,
    collider: null,
    wanderAI: null,
  };
  presentation.receive({ ...motion, self: false }, 0);
  expect(presentation.entities([actor], "street", 200)[0]?.position.wy).toBe(112);
  expect(actor.position.wy).toBe(120);
  expect(presentation.entities([actor], "other-realm", 200)[0]).toBe(actor);
  expect(presentation.busy).toBe(false);
  presentation.receive({ ...motion, phase: "arrive", self: false }, 300);
  expect(presentation.entities([actor], "street", 701)[0]).toBe(actor);
});
it("keeps a shared door open while another player is still using it", () => {
  const presentation = new DoorPresentation();
  presentation.receive({ ...motion, self: false }, 0);
  presentation.receive({ ...motion, actorClientId: "bob", actorId: 2, self: false }, 400);
  const items: SceneItem[] = [];
  presentation.appendOverlays(items, "street", 700);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ kind: "sprite", frameCol: 6 });
});

it("reveals the player at the exterior threshold before walking to the safe landing", () => {
  const presentation = new DoorPresentation();
  const arrival: DoorMotion = {
    ...motion,
    phase: "arrive",
    from: { wx: 100, wy: 96 },
    to: { wx: 100, wy: 120 },
    revealMs: 180,
  };
  const actor: Entity = {
    id: 1,
    type: "player",
    position: { ...arrival.to },
    sprite: null,
    velocity: null,
    collider: null,
    wanderAI: null,
  };
  presentation.receive(arrival, 0);
  presentation.update("street", false, 500);
  expect(veil.style.opacity).toBe("1");
  presentation.update("street", true, 1000);
  presentation.update("street", true, 1180);
  expect(veil.style.opacity).toBe("0");
  expect(presentation.entities([actor], "street", 1180)[0]?.position).toEqual(arrival.from);
  expect(presentation.entities([actor], "street", 1380)[0]?.position.wy).toBe(108);
  expect(presentation.busy).toBe(true);
  presentation.update("street", true, 1580);
  expect(presentation.entities([actor], "street", 1580)[0]).toBe(actor);
  expect(presentation.busy).toBe(false);
  expect(actor.position).toEqual(arrival.to);
});

it("presents a guest-led walk as the device's own, whichever copy reaches it first (5-ii-c)", () => {
  // Seat 0's channel carries a copy of its guest's walk (not self); the guest's envelope
  // carries its own (self). Either order shows the guest's own walk out after loading.
  const arrival: DoorMotion = {
    ...motion,
    phase: "arrive",
    actorClientId: "dev#1",
    from: { wx: 100, wy: 104 },
    to: { wx: 100, wy: 120 },
  };
  const actor: Entity = {
    id: 1,
    type: "player",
    position: { ...arrival.to },
    sprite: null,
    velocity: null,
    collider: null,
    wanderAI: null,
  };
  for (const copyFirst of [true, false]) {
    const presentation = new DoorPresentation();
    const copy = { ...arrival, self: false };
    if (copyFirst) presentation.receive(copy, 0);
    presentation.receive(arrival, 0);
    if (!copyFirst) presentation.receive(copy, 0);
    // Loading: the veil is down and the guest waits at its landing.
    presentation.update("street", false, 500);
    expect(veil.style.opacity).toBe("1");
    expect(presentation.entities([actor], "street", 500)[0]).toBe(actor);
    // Loaded: the walk in starts now, not when the copy arrived.
    presentation.update("street", true, 1000);
    expect(presentation.entities([actor], "street", 1200)[0]?.position.wy).toBe(112);
    presentation.update("street", true, 1580);
    expect(presentation.busy).toBe(false);
  }
});
