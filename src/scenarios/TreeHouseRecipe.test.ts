import { expect, it } from "vitest";
import { RemoteStateView } from "../client/ClientStateView.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { predictInput } from "../client/predictInput.js";
import { DECK_Z } from "../entities/TreeHouse.js";
import { observerInsideRoom } from "../rendering/collectScene.js";
import { decodeServerMessage } from "../shared/binaryCodec.js";
import type { Movement } from "../shared/Movement.js";
import type { BufferedMessage } from "../shared/protocol.js";
import { World } from "../world/World.js";
import { ScenarioSession } from "./ScenarioSession.js";
import { TREE_HOUSE_STARTS, treeHouseRecipe } from "./TreeHouseRecipe.js";

const idle: Movement = { dx: 0, dy: 0, jump: false, sprinting: false };
const z = (s: ScenarioSession) => s.player.player.wz ?? 0;
async function steps(s: ScenarioSession, count: number, input = idle) {
  for (let i = 0; i < count; i++) await s.step(input);
}
function room(s: ScenarioSession) {
  const house = s.realm.propManager.props.find((p) => p.walls?.some((w) => w.room));
  if (!house) throw Error("Missing tree house");
  const p = s.player.player;
  return observerInsideRoom(house, { wx: p.position.wx, wy: p.position.wy - 3, z: z(s) });
}

it("cannot jump onto the deck, climbs the ladder, holds on, enters the cabin and climbs down", async () => {
  const s = await ScenarioSession.create(treeHouseRecipe());
  try {
    // The deck is above the jump apex: pressing north and jumping at the deck
    // edge west of the ladder never reaches the porch.
    const ground = TREE_HOUSE_STARTS.ground.position;
    await s.command({
      kind: "teleport",
      position: { wx: ground.wx + 40, wy: ground.wy },
      z: 0,
    });
    let peak = 0;
    for (let i = 0; i < 90; i++) {
      await s.step({ ...idle, dy: -1, jump: i % 30 < 15 });
      peak = Math.max(peak, z(s));
    }
    await steps(s, 40);
    expect(peak).toBeLessThan(DECK_Z);
    expect(z(s)).toBeCloseTo(0, 1);

    await s.command({ kind: "teleport", ...TREE_HOUSE_STARTS.ground });
    let prior = 0;
    for (let i = 0; i < 60 && z(s) < 12; i++) {
      await s.step({ ...idle, dy: -1 });
      expect(z(s)).toBeGreaterThanOrEqual(prior - 0.5);
      prior = z(s);
    }
    expect(z(s)).toBeGreaterThan(8);
    // Letting go of the controls holds on rather than sliding down.
    const held = z(s);
    await steps(s, 60);
    expect(z(s)).toBeCloseTo(held, 0);
    // Save/reload mid-ladder keeps the climber in place.
    await s.reload();
    expect(z(s)).toBeCloseTo(held, 0);
    await steps(s, 20);
    expect(z(s)).toBeCloseTo(held, 0);

    // Continue up and step north onto the porch, then walk in through the door.
    await steps(s, 60, { ...idle, dy: -1 });
    expect(z(s)).toBeCloseTo(DECK_Z, 0);
    expect(s.player.player.jumpVZ).toBeUndefined();
    expect(room(s)).toBe(false);
    await s.command({ kind: "teleport", ...TREE_HOUSE_STARTS.porch });
    await steps(s, 2);
    const doorX = TREE_HOUSE_STARTS.inside.position.wx;
    for (let i = 0; i < 120 && Math.abs(s.player.player.position.wx - doorX) > 1; i++)
      await s.step({ ...idle, dx: Math.sign(doorX - s.player.player.position.wx) });
    await steps(s, 20, { ...idle, dy: -1 });
    expect(z(s)).toBeCloseTo(DECK_Z, 0);
    expect(room(s)).toBe(true);
    // The north cabin wall keeps the player on the deck.
    await steps(s, 60, { ...idle, dy: -1 });
    expect(z(s)).toBeCloseTo(DECK_Z, 0);
    expect(room(s)).toBe(true);
    await s.reload();
    expect(room(s)).toBe(true);

    // Back out to the porch, over to the ladder and down to the ground.
    await steps(s, 30, { ...idle, dy: 1 });
    const ladderX = TREE_HOUSE_STARTS.porch.position.wx;
    for (let i = 0; i < 120 && Math.abs(s.player.player.position.wx - ladderX) > 1; i++)
      await s.step({ ...idle, dx: Math.sign(ladderX - s.player.player.position.wx) });
    expect(z(s)).toBeCloseTo(DECK_Z, 0);
    let lowest = DECK_Z;
    for (let i = 0; i < 120; i++) {
      await s.step({ ...idle, dy: 1 });
      // Descending is a controlled climb, never a fall.
      expect(z(s)).toBeGreaterThan(lowest - 2);
      lowest = Math.min(lowest, z(s));
    }
    expect(z(s)).toBeCloseTo(0, 1);
    expect(s.player.player.position.wy).toBeGreaterThan(ground.wy - 12);
  } finally {
    await s.close();
  }
});

it("lets go sideways and predicts the climb through the shared kernel", async () => {
  const s = await ScenarioSession.create(treeHouseRecipe());
  const view = new RemoteStateView(new World());
  const predictor = new PlayerPredictor(() => s.gravity);
  const sync = () => {
    for (const packet of s.frames()) {
      const m = decodeServerMessage(packet);
      if (m.type !== "sync-cvars" && (m.type === "frame" || m.type.startsWith("sync-")))
        view.applyMessage(m as BufferedMessage);
    }
    predictor.reconcile(
      view.serverPlayerEntity,
      view.lastProcessedInputSeq,
      view.world,
      view.props,
      view.serverEntityMap,
      view.mountEntityId,
      { serverTick: view.serverTick, ...(view.physicsState ? { physics: view.physicsState } : {}) },
    );
  };
  try {
    await predictor.ready;
    await s.step(idle);
    sync();
    predictor.reset(view.serverPlayerEntity);
    sync();
    const first = view.lastProcessedInputSeq + 1;
    for (let i = 0; i < 40; i++) {
      const input = { ...idle, dy: -1 };
      predictInput(predictor, first + i, input, 1 / 60, view.world, view.props, view.entities);
      await s.step(input);
      sync();
      expect(predictor.player?.wz ?? 0).toBeCloseTo(z(s), 1);
    }
    expect(z(s)).toBeGreaterThan(10);
    // Sideways input releases the ladder: the player drops back to the ground.
    await steps(s, 40, { ...idle, dx: 1 });
    expect(z(s)).toBeCloseTo(0, 1);
  } finally {
    predictor.clearPredicted();
    await s.close();
  }
});
