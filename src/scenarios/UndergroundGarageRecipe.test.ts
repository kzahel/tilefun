import { expect, it } from "vitest";
import { RemoteStateView } from "../client/ClientStateView.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { predictInput } from "../client/predictInput.js";
import { locateSurfaceSpace } from "../physics/TerrainExcavation.js";
import { decodeServerMessage, quantizeInputDtMs } from "../shared/binaryCodec.js";
import type { BufferedMessage } from "../shared/protocol.js";
import { World } from "../world/World.js";
import { ScenarioSession } from "./ScenarioSession.js";
import { GARAGE_STARTS, undergroundGarageRecipe } from "./UndergroundGarageRecipe.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
it("walks continuously from street down into the garage and back in one realm", async () => {
  const s = await ScenarioSession.create(undergroundGarageRecipe());
  try {
    const id = s.player.player.id;
    let previous = 0;
    const spaces = new Set<string>();
    for (let i = 0; i < 260; i++) {
      await s.step({ ...idle, dx: 1 });
      const player = s.player.player,
        z = player.wz ?? 0;
      expect(z).toBeLessThanOrEqual(previous + 0.001);
      expect(previous - z).toBeLessThan(1);
      expect(player.jumpVZ).toBeUndefined();
      spaces.add(locateSurfaceSpace(s.realm.propManager.props, player));
      previous = z;
    }
    expect(s.player.player.wz).toBe(-48);
    expect(spaces).toEqual(new Set(["outside", "garage-entry", "garage"]));
    expect(s.player.player.id).toBe(id);
    const position = { ...s.player.player.position };
    await s.reload();
    expect(s.player.player.wz).toBe(-48);
    expect(s.player.player.position).toEqual(position);
    expect(locateSurfaceSpace(s.realm.propManager.props, s.player.player)).toBe("garage");
    for (let i = 0; i < 260; i++) await s.step({ ...idle, dx: -1 });
    expect(s.player.player.wz).toBe(0);
    expect(locateSurfaceSpace(s.realm.propManager.props, s.player.player)).toBe("outside");
  } finally {
    await s.close();
  }
});

it("retains solid terrain boundaries, ceiling headroom, and usable street at the same XY", async () => {
  const s = await ScenarioSession.create(undergroundGarageRecipe());
  try {
    await s.command({ kind: "teleport", ...GARAGE_STARTS.garage });
    let highest = -48;
    for (let i = 0; i < 70; i++) {
      await s.step({ ...idle, jump: i < 20 });
      highest = Math.max(highest, s.player.player.wz ?? 0);
      expect((s.player.player.wz ?? 0) + 12).toBeLessThanOrEqual(-8 + 0.001);
      expect(locateSurfaceSpace(s.realm.propManager.props, s.player.player)).toBe("garage");
    }
    expect(highest).toBeGreaterThan(-30);
    expect(s.player.player.wz).toBe(-48);
    for (let i = 0; i < 90; i++) await s.step({ ...idle, dy: 1 });
    expect(s.player.player.position.wy).toBeLessThanOrEqual(64);
    expect(s.player.player.wz).toBe(-48);
    await s.command({ kind: "teleport", ...GARAGE_STARTS.street });
    for (let i = 0; i < 90; i++) await s.step({ ...idle, dy: 1 });
    expect(s.player.player.position.wy).toBeGreaterThan(80);
    expect(s.player.player.wz).toBe(0);
  } finally {
    await s.close();
  }
});

it("replicates excavation geometry and predicts negative-height movement exactly like authority", async () => {
  const s = await ScenarioSession.create(undergroundGarageRecipe());
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
    expect(view.props.filter((p) => p.collider?.surface?.excavation)).toHaveLength(2);
    predictor.reset(view.serverPlayerEntity);
    const dt = quantizeInputDtMs(1000 / 60) / 1000;
    for (let i = 1; i <= 270; i++) {
      const input = { ...idle, dx: 1 };
      predictInput(predictor, i, input, dt, view.world, view.props, view.entities);
      await s.step(input, dt);
      expect(predictor.player?.position.wx).toBeCloseTo(s.player.player.position.wx, 3);
      expect(predictor.player?.wz).toBeCloseTo(s.player.player.wz ?? 0, 3);
    }
    expect(predictor.player?.wz).toBe(-48);
    expect(s.player.player.wz).toBe(-48);
  } finally {
    await s.close();
  }
});

it("reloads on the descending ramp and preserves geometry across a chunk seam", async () => {
  const recipe = undergroundGarageRecipe();
  // Move the join to x=256, crossing the production chunk boundary.
  recipe.player.position.wx += 256;
  for (const prop of recipe.props) prop.position.wx += 256;
  const s = await ScenarioSession.create(recipe);
  try {
    for (let i = 0; i < 120; i++) await s.step({ ...idle, dx: 1 });
    const before = { ...s.player.player.position },
      z = s.player.player.wz;
    expect(z).toBeLessThan(-10);
    expect(z).toBeGreaterThan(-40);
    await s.reload();
    expect(s.player.player.position).toEqual(before);
    expect(s.player.player.wz).toBe(z);
    await s.step(idle);
    expect(s.player.player.wz).toBeCloseTo(z ?? 0, 3);
    for (let i = 0; i < 140; i++) await s.step({ ...idle, dx: 1 });
    expect(s.player.player.position.wx).toBeGreaterThan(256);
    expect(s.player.player.wz).toBe(-48);
    expect(locateSurfaceSpace(s.realm.propManager.props, s.player.player)).toBe("garage");
  } finally {
    await s.close();
  }
});
