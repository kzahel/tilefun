import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { TerrainId } from "../autotile/TerrainId.js";
import { createPlayer } from "../entities/Player.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { creatureSpecies, dietFor } from "./FoodWeb.js";
import { NATURAL_HUNTER_PROFILES } from "./NaturalHunters.js";
import { createPredator, predatorType } from "./Predator.js";
import { restorePredatorPose } from "./PredatorMotion.js";

const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
describe.each(NATURAL_HUNTER_PROFILES)("$species natural source and ecology", (p) => {
  it("selects the exact source bank and independently matched walk and chase strides", () => {
    const base = `public/demos/wildlife-v2/${p.species}/${p.revision}`;
    const m = JSON.parse(readFileSync(`${base}/sprite.json`, "utf8"));
    expect(m.identity).toBe(p.art.identity);
    expect(
      createHash("sha256")
        .update(readFileSync(`${base}/sheet.png`))
        .digest("hex"),
    ).toBe(p.art.sha256);
    for (const c of p.art.clips) {
      expect(m.clips[c.name]).toMatchObject({
        start: c.start,
        count: c.count,
        frameDuration: c.frameDuration,
      });
    }
    const duration = (name: string) => {
      const c = required(p.art.clips.find((c) => c.name === name));
      return (c.count * c.frameDuration) / 1000;
    };
    let walkTravel = m.rootTravelPixelsPerCycle;
    let chaseTravel = m.chaseRootTravelPixelsPerCycle;
    if (walkTravel === undefined || chaseTravel === undefined) {
      // Measure a planted foot in the source camera rather than assuming four
      // feet or identical walk/chase spatial paths across animal families.
      const pixels = JSON.parse(readFileSync(`${base}/pixel-audit.json`, "utf8"));
      const audit = JSON.parse(readFileSync(`${base}/source-audit.json`, "utf8"));
      type Volume = { name: string; group: string; points: number[][] };
      type Pose = {
        facing: string;
        clip: string;
        index: number;
        volumes: Volume[];
        body: number[];
      };
      const source = JSON.parse(
        readFileSync(`art-source/wildlife-v2/${p.species}/${p.revision}/projection.json`, "utf8"),
      ) as { records: Pose[] };
      expect(source.records.filter((r) => r.clip === "walk")).toHaveLength(128);
      const travel = (clip: string) => {
        const poses = [4, 8].map((index) =>
          required(
            source.records.find((r) => r.facing === "left" && r.clip === clip && r.index === index),
          ),
        );
        const planted = Object.entries(audit.footfallOffsets ?? {}).find(
          ([, offset]) => Number(offset) === 0,
        )?.[0];
        const name = planted
          ? `${planted}-foot`
          : required(poses[0]).volumes.some((v) => v.name === "hind-1-foot")
            ? "hind-1-foot"
            : "leg-1-foot";
        const centers = poses.map((pose) => {
          const foot = required(pose.volumes.find((v) => v.name === name));
          const xs = foot.points.map((xy) => required(xy[0]));
          return (Math.min(...xs) + Math.max(...xs)) / 2;
        });
        const camera = JSON.parse(readFileSync("art-source/wildlife-v2/camera.json", "utf8"));
        const horizontalProjection = Math.abs(
          Math.sin((camera.modelYawDegrees.left * Math.PI) / 180),
        );
        return (Math.abs(required(centers[1]) - required(centers[0])) * 8) / horizontalProjection;
      };
      walkTravel = travel("walk");
      chaseTravel = travel("chase");
      expect(walkTravel).toBeCloseTo(pixels.rootTravelPixelsPerCycle, 2);
      expect(audit.plantedTravelPairs).toBeGreaterThan(0);
      expect(audit.maxContactSlideWorldUnits).toBeLessThan(0.0001);
      for (const facing of ["down", "up", "left", "right"]) {
        const ys = source.records
          .filter((r) => r.clip === "chase" && r.facing === facing)
          .map((r) => required(r.body[1]));
        expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(1);
      }
    }
    expect(walkTravel).toBeCloseTo(p.speed * duration(required(p.art.clips[1]).name), 2);
    expect(chaseTravel).toBeCloseTo(p.chaseSpeed * duration("chase"), 2);
    const hunter = createPredator(p.species, 0, 0);
    required(hunter.predator).state = "pounce";
    restorePredatorPose(hunter);
    expect(hunter.sprite?.clip).toBe(4);
    required(hunter.predator).state = "feed";
    restorePredatorPose(hunter);
    expect(hunter.sprite?.clip).toBe(2);
  });
  it("seeds one hunter and suitable local prey with stable ownership across chunk order", () => {
    const [x, y] = p.expansion.inspection,
      gx = Math.floor(x / 64),
      gy = Math.floor(y / 64);
    const coords = Array.from(
      { length: 16 },
      (_, i) => [gx * 4 + (i % 4), gy * 4 + Math.floor(i / 4)] as const,
    );
    const collect = (reverse: boolean) => {
      const n = new NaturalLandscape(regionalWorld(2026), "thicket");
      return (reverse ? [...coords].reverse() : coords)
        .flatMap(([cx, cy]) => n.expansionPredators(cx, cy))
        .sort((a, b) => a.featureId.localeCompare(b.featureId));
    };
    const a = collect(false);
    expect(a).toEqual(collect(true));
    expect(a.filter((a) => a.predator)).toHaveLength(1);
    expect(a.filter((a) => a.rabbit)).toHaveLength(p.preySpecies ? 0 : 2);
    expect(a.filter((a) => a.deer || a.fauna)).toHaveLength(
      (p.preySpecies ? 2 : 0) + (dietFor(p.species).has("deer") ? 1 : 0),
    );
    if (p.preySpecies)
      expect(a.filter((a) => a.fauna).every((a) => creatureSpecies(a) === p.preySpecies)).toBe(
        true,
      );
    for (const prey of a.filter((e) => !e.predator))
      expect(dietFor(p.species).has(creatureSpecies(prey) ?? "")).toBe(true);
    expect(new Set(a.map((a) => a.featureId)).size).toBe(a.length);
    const n = new NaturalLandscape(regionalWorld(2026), "thicket");
    for (const actor of a) expect(n.terrain(actor.wx / 16, actor.wy / 16)).toBe(TerrainId.Grass);
  });
  it("actually hunts its generated population and reloads the same natural lineage", async () => {
    const [x, y] = p.expansion.inspection;
    const s = await ScenarioSession.create({
      version: 1,
      id: `natural-hunter-${p.species}`,
      generation: createDescriptor("regional", 2026),
      landscape: "thicket",
      player: createPlayer(x * 16 - 128, y * 16 + 160),
      actors: [],
      props: [],
    });
    try {
      const entities = () => s.realm.entityManager.entities;
      const hunter = () => required(entities().find((e) => e.type === predatorType(p.species)));
      const h = hunter();
      expect(h.proceduralId).toContain("fauna-expansion-home:");
      for (let i = 0; i < 1200 && !hunter().predator?.meals; i++) await s.step(idle);
      expect(hunter().predator?.meals).toBeGreaterThan(0);
      const pending = [...s.realm.entityManager.wildlifeRespawns.values()].filter((j) =>
        j.actor.state.naturalSpawnId?.startsWith(`wildlife:expansion-prey:${p.species}:`),
      );
      expect(pending.length).toBeGreaterThan(0);
      expect(pending.every((j) => j.remaining > 0)).toBe(true);
      const saved = JSON.parse(JSON.stringify(hunter().predator));
      const queued = JSON.parse(
        JSON.stringify([...s.realm.entityManager.wildlifeRespawns.values()]),
      ) as { actor: { persistentId: string } }[];
      queued.sort((a, b) => a.actor.persistentId.localeCompare(b.actor.persistentId));
      await s.reload();
      expect(hunter().predator).toEqual(saved);
      expect(
        [...s.realm.entityManager.wildlifeRespawns.values()].sort((a, b) =>
          a.actor.persistentId.localeCompare(b.actor.persistentId),
        ),
      ).toEqual(queued);
    } finally {
      await s.close();
    }
  }, 60000);
});

it("seeds authored antelopes as legal natural companions in hunter clearings", () => {
  const n = new NaturalLandscape(regionalWorld(2026), "thicket");
  const prey = NATURAL_HUNTER_PROFILES.flatMap((p) => {
    const [x, y] = p.expansion.inspection;
    const gx = Math.floor(x / 64),
      gy = Math.floor(y / 64);
    return Array.from({ length: 16 }, (_, i) =>
      n.expansionPredators(gx * 4 + (i % 4), gy * 4 + Math.floor(i / 4)),
    )
      .flat()
      .filter((a) => a.fauna);
  });
  expect(prey.length).toBeGreaterThan(0);
  expect(prey.every((a) => a.featureId.startsWith("wildlife:expansion-prey:"))).toBe(true);
});
