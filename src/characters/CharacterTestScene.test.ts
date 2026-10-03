import { afterEach, describe, expect, it, vi } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { CHARACTERS } from "./CharacterCatalog.js";
import { CharacterTestScene } from "./CharacterTestScene.js";

// Simulation tests need only the fixture's tiny procedural obstacle canvases.
// Actual game rendering and source verification run in the browser tests.
function fixture() {
  vi.stubGlobal("document", {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ fillRect() {}, strokeRect() {} }),
    }),
  });
  const def = required(CHARACTERS[0]);
  return new CharacterTestScene(def, def.defaults, {} as HTMLImageElement, {} as HTMLImageElement);
}
afterEach(() => vi.unstubAllGlobals());
function walk(scene: CharacterTestScene, dx: number, dy: number, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) scene.step(dx, dy, false, 1 / 60);
}
describe("production character fixture physics", () => {
  it("blocks against walls and changes passage clearance with collider width", () => {
    const s = fixture();
    s.actor.position = { wx: -64, wy: 8 };
    walk(s, 0, -1, 3);
    expect(s.actor.position.wy).toBeGreaterThanOrEqual(-19.01);
    s.reset();
    s.actor.position.wx = 68;
    walk(s, 0, -1, 3);
    expect(s.actor.position.wy).toBeLessThan(-40);
    s.update({ ...s.settings, width: 20 });
    s.reset();
    s.actor.position.wx = 68;
    walk(s, 0, -1, 3);
    expect(s.actor.position.wy).toBeGreaterThanOrEqual(-19.01);
  });
  it("climbs the steps and uses physical height for overhead clearance", () => {
    const s = fixture();
    s.actor.position = { wx: -96, wy: 40 };
    walk(s, 1, 0, 2.5);
    expect(s.actor.wz).toBe(12);
    s.reset();
    s.actor.position = { wx: 68, wy: 68 };
    walk(s, 0, -1, 2);
    expect(s.actor.position.wy).toBeGreaterThanOrEqual(55.99);
    s.update({ ...s.settings, physicalHeight: 19 });
    s.reset();
    s.actor.position = { wx: 68, wy: 68 };
    walk(s, 0, -1, 2);
    expect(s.actor.position.wy).toBeLessThan(35);
  });
});
