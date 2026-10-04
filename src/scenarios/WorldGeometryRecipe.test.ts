import { expect, it } from "vitest";
import { RemoteStateView } from "../client/ClientStateView.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { predictInput } from "../client/predictInput.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Movement } from "../input/ActionManager.js";
import { querySurfacePatch } from "../physics/SurfacePatch.js";
import { surfaceVisibility } from "../rendering/SurfacePresentation.js";
import { decodeServerMessage, quantizeInputDtMs } from "../shared/binaryCodec.js";
import type { BufferedMessage } from "../shared/protocol.js";
import { World } from "../world/World.js";
import { ScenarioSession } from "./ScenarioSession.js";
import { GEOMETRY_STARTS, surfaceProp, worldGeometryRecipe } from "./WorldGeometryRecipe.js";

const idle: Movement = { dx: 0, dy: 0, jump: false, sprinting: false };
async function steps(s: ScenarioSession, count: number, input = idle) {
  for (let i = 0; i < count; i++) await s.step(input);
}

it("climbs a continuous ramp, joins the deck, reloads there and falls off the edge", async () => {
  const s = await ScenarioSession.create(worldGeometryRecipe());
  try {
    let priorZ = 0;
    for (let i = 0; i < 250; i++) {
      await s.step({ ...idle, dx: 1 });
      const z = s.player.player.wz ?? 0;
      expect(z).toBeGreaterThanOrEqual(priorZ - 0.001);
      expect(z - priorZ).toBeLessThan(1);
      priorZ = z;
    }
    expect(s.player.player.wz).toBe(48);
    expect(s.player.player.position.wx).toBeGreaterThan(30);
    const pos = { ...s.player.player.position };
    await s.reload();
    expect(s.player.player.wz).toBe(48);
    expect(s.player.player.position).toEqual(pos);
    await steps(s, 1);
    expect(s.player.player.wz).toBe(48);
    await steps(s, 130, { ...idle, dy: 1 });
    expect(s.player.player.wz).toBe(0);
    expect(s.player.player.position.wy).toBeGreaterThan(90);
  } finally {
    await s.close();
  }
});

it("walks down the ramp and reloads mid-slope without changing support", async () => {
  const s = await ScenarioSession.create(worldGeometryRecipe());
  try {
    await s.command({ kind: "teleport", ...GEOMETRY_STARTS.deck });
    await steps(s, 125, { ...idle, dx: -1 });
    const z = s.player.player.wz ?? 0;
    expect(z).toBeGreaterThan(10);
    expect(z).toBeLessThan(45);
    await s.reload();
    expect(s.player.player.wz).toBeCloseTo(z, 4);
    await steps(s, 1);
    expect(s.player.player.wz).toBeCloseTo(z, 4);
    await steps(s, 170, { ...idle, dx: -1 });
    expect(s.player.player.wz).toBe(0);
  } finally {
    await s.close();
  }
});

it("keeps actors below the deck, catches upward head impacts, and reveals per observer", async () => {
  const s = await ScenarioSession.create(worldGeometryRecipe());
  try {
    await s.command({ kind: "teleport", ...GEOMETRY_STARTS.passage });
    let maximum = 0;
    for (let i = 0; i < 90; i++) {
      await s.step({ ...idle, jump: i < 20 });
      maximum = Math.max(maximum, s.player.player.wz ?? 0);
      expect(
        (s.player.player.wz ?? 0) + (s.player.player.collider?.physicalHeight ?? 0),
      ).toBeLessThanOrEqual(40.001);
    }
    expect(maximum).toBeGreaterThan(20);
    expect(s.player.player.wz).toBe(0);
    const deck = s.realm.propManager.props.find((p) => p.collider?.surface?.id === "deck");
    if (!deck?.collider?.surface) throw new Error("Missing deck");
    const bounds = getEntityAABB(deck.position, deck.collider);
    const upper = structuredClone(s.player.player);
    upper.wz = 48;
    expect(surfaceVisibility(deck.collider.surface, bounds, s.player.player, "auto")).toBe(false);
    expect(surfaceVisibility(deck.collider.surface, bounds, upper, "auto")).toBe(true);
    expect(surfaceVisibility(deck.collider.surface, bounds, s.player.player, "all")).toBe(true);
    expect(surfaceVisibility(deck.collider.surface, bounds, upper, "lower")).toBe(false);
    await s.reload();
    await steps(s, 110, { ...idle, dy: 1 });
    expect(s.player.player.wz).toBe(0);
    expect(s.player.player.position.wy).toBeGreaterThan(90);
  } finally {
    await s.close();
  }
});

it("replicates surfaces through the normal codec and predicts the same ramp movement as authority", async () => {
  const s = await ScenarioSession.create(worldGeometryRecipe());
  const view = new RemoteStateView(new World());
  const predictor = new PlayerPredictor(
    () => s.physics,
    () => 1,
  );
  try {
    for (const packet of s.frames()) {
      const m = decodeServerMessage(packet);
      if (m.type !== "sync-cvars" && (m.type === "frame" || m.type.startsWith("sync-")))
        view.applyMessage(m as BufferedMessage);
    }
    expect(view.props.filter((p) => p.collider?.surface)).toHaveLength(2);
    predictor.reset(view.serverPlayerEntity);
    const dt = quantizeInputDtMs(1000 / 60) / 1000;
    for (let i = 1; i <= 260; i++) {
      const input = { ...idle, dx: 1 };
      predictInput(predictor, i, input, dt, view.world, view.props, view.entities);
      await s.step(input, dt);
      expect(predictor.player?.position.wx).toBeCloseTo(s.player.player.position.wx, 3);
      expect(predictor.player?.wz ?? 0).toBeCloseTo(s.player.player.wz ?? 0, 3);
    }
  } finally {
    await s.close();
  }
});

it("queries the overlapping part of either slope direction and rejects malformed geometry", async () => {
  const p = {
    id: "r",
    spaceId: "upper",
    z: 40,
    riseX: -32,
    riseY: 16,
    thickness: 8,
    connectsTo: [],
  };
  expect(
    querySurfacePatch(
      p,
      { left: 0, top: 0, right: 32, bottom: 32 },
      { left: 8, top: 8, right: 16, bottom: 16 },
    ),
  ).toMatchObject({ topMin: 28, topMax: 40, bottomMin: 20 });
  const recipe = worldGeometryRecipe();
  const patch = recipe.props[0]?.collider?.surface;
  if (!patch) throw new Error("Missing ramp");
  patch.thickness = NaN;
  await expect(ScenarioSession.create(recipe)).rejects.toThrow("Invalid surface patch");
});

it("resumes vertical motion when reloading during a fall instead of selecting the floor above", async () => {
  const s = await ScenarioSession.create(worldGeometryRecipe());
  try {
    await s.command({ kind: "teleport", position: { wx: 192, wy: 8 }, z: 48 });
    await steps(s, 5);
    const z = s.player.player.wz,
      velocity = s.player.player.jumpVZ;
    expect(z).toBeGreaterThan(0);
    expect(velocity).toBeLessThan(0);
    await s.reload();
    expect(s.player.player.wz).toBe(z);
    expect(s.player.player.jumpVZ).toBe(velocity);
    await steps(s, 45);
    expect(s.player.player.wz).toBe(0);
    expect(s.player.player.jumpVZ).toBeUndefined();
  } finally {
    await s.close();
  }
});

it("blocks a climb with insufficient headroom and cannot enter a slab from its side", async () => {
  const recipe = worldGeometryRecipe();
  recipe.props.push(
    surfaceProp(
      { left: -144, top: -32, right: -48, bottom: 32 },
      {
        id: "low-ceiling",
        spaceId: "ceiling",
        z: 38,
        riseX: 0,
        riseY: 0,
        thickness: 8,
        connectsTo: [],
      },
    ),
  );
  const s = await ScenarioSession.create(recipe);
  try {
    await steps(s, 220, { ...idle, dx: 1 });
    expect(s.player.player.position.wx).toBeGreaterThan(-150);
    expect(s.player.player.position.wx).toBeLessThan(-120);
    expect((s.player.player.wz ?? 0) + 12).toBeLessThanOrEqual(30.001);
    await s.command({ kind: "teleport", position: { wx: 80, wy: 80 }, z: 42 });
    // Give the actor horizontal intent before gravity, against the deck's solid edge.
    await s.step({ ...idle, dy: -1 }, 0.1);
    expect(s.player.player.position.wy).toBeGreaterThan(64);
  } finally {
    await s.close();
  }
});
