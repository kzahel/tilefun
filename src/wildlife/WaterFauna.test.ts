import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { TerrainId } from "../autotile/TerrainId.js";
import { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { createFauna, FAUNA_PROFILES, faunaDefinition, faunaType } from "./Fauna.js";
import { faunaHabitatAllows, updateFaunaAI } from "./faunaAI.js";
import { startleFauna } from "./faunaInteractions.js";

const env = {
  isWater: (p: { wx: number }) => p.wx >= 160,
  isDeepWater: (p: { wx: number }) => p.wx >= 192,
  canOccupy: () => true,
  surfaceZ: () => 0,
};

describe.each(FAUNA_PROFILES.filter((p) => ["pond", "shore", "deep"].includes(p.habitat)))(
  "$species water authority",
  (p) => {
    it("uses the frozen native cells, anchors, all activities and matched escape cadence", () => {
      const m = JSON.parse(
        readFileSync(`public/${p.image.replace("sheet.png", "sprite.json")}`, "utf8"),
      );
      expect(
        createHash("sha256")
          .update(readFileSync(`public/${p.image}`))
          .digest("hex"),
      ).toBe(p.sha256);
      expect(m.identity).toBe(p.identity);
      expect(m.anchor).toEqual(p.anchor);
      expect(m.frameWidth).toBe(p.size);
      for (const c of p.clips.filter((c) => !c.name.startsWith("flee"))) {
        expect(m.clips[c.name].start).toBe(c.start);
        expect(m.clips[c.name].count).toBe(c.count);
      }
      const def = faunaDefinition(p);
      expect(def.aquatic).toBe(p.habitat !== "shore");
      expect(def.amphibious).toBe(p.habitat === "shore");
      for (const c of p.clips.filter((c) => c.name.startsWith("flee"))) {
        const native = required(
          p.clips.find((n) => n.start === c.start && !n.name.startsWith("flee")),
        );
        expect(c.frameDuration * 2).toBe(native.frameDuration);
        expect(c.count).toBe(native.count);
      }
    });

    it("settles a closed refuge without teleporting, re-alarming or replacing an animal", () => {
      const animal = createFauna(p.species, 256, 64),
        before = { ...animal.position };
      startleFauna(animal, { wx: 210, wy: 64 });
      updateFaunaAI(animal, 0.5, { ...env, canOccupy: () => false }, [animal], []);
      expect(animal.fauna?.state).toBe("recover");
      expect(animal.position).toEqual(before);
      expect(animal.fauna?.alarmFrom).toBeUndefined();
    });
    it("seeds durable suitable populations deterministically across chunk order and bounded water caches", () => {
      const [x, y] = p.inspection;
      const coords = Array.from({ length: 64 }, (_, i) => ({
        cx: Math.floor(x / 16) - 4 + (i % 8),
        cy: Math.floor(y / 16) - 4 + Math.floor(i / 8),
      }));
      const n = new NaturalLandscape(regionalWorld(2026), "thicket"),
        other = new NaturalLandscape(regionalWorld(2026), "thicket");
      const collect = (n: NaturalLandscape, reverse: boolean) =>
        (reverse ? [...coords].reverse() : coords)
          .flatMap((c) => n.wildlife(c.cx, c.cy))
          .filter((a) => a.type === faunaType(p.species))
          .sort((a, b) => a.featureId.localeCompare(b.featureId));
      const a = collect(n, false);
      expect(a).toEqual(collect(other, true));
      expect(a.length).toBeGreaterThanOrEqual(p.group);
      expect(new Set(a.map((a) => a.featureId)).size).toBe(a.length);
      for (const actor of a) {
        const water = [TerrainId.ShallowWater, TerrainId.DeepWater].includes(
          n.terrain(actor.wx / 16, actor.wy / 16),
        );
        expect(actor.fauna?.water).toBe(water);
        if (p.habitat === "deep")
          expect(n.terrain(actor.wx / 16, actor.wy / 16)).toBe(TerrainId.DeepWater);
        if (p.habitat === "pond") expect(water).toBe(true);
        expect(n.reserved(actor.wx / 16, actor.wy / 16, 2)).toBe(false);
      }
      for (let i = 0; i < 150; i++) n.lagoon(1000 + i, 1000);
      expect(n.cacheSizes.lagoons).toBeLessThanOrEqual(128);
    });
  },
);

it("large aquatic path clearance checks internal footprint tiles, not only center or corners", () => {
  const ray = createFauna("manta-ray", 256, 64);
  expect(
    faunaHabitatAllows(ray, ray.position, {
      ...env,
      isDeepWater: (p) => !(p.wx === 248 && p.wy === 56),
    }),
  ).toBe(false);
  expect(faunaHabitatAllows(ray, ray.position, env)).toBe(true);
});
