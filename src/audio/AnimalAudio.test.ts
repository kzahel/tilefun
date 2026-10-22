import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import receipt from "../../art-source/animal-audio/familiar-v1/manifest.json";
import farmReceipt from "../../art-source/animal-audio/farm-v1/manifest.json";
import birdReceipt from "../../art-source/animal-audio/garden-birds-v1/manifest.json";
import gardenReceipt from "../../art-source/animal-audio/garden-v1/manifest.json";
import { required } from "../art/ArtCatalog.js";
import { createBall } from "../entities/Ball.js";
import { ENTITY_DEFS } from "../entities/EntityDefs.js";
import { createPlayer } from "../entities/Player.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { createFauna } from "../wildlife/Fauna.js";
import { createForageItem } from "../wildlife/ForageResources.js";
import { createPredator } from "../wildlife/Predator.js";
import { ANIMAL_BROWSER_ENTRIES } from "../workshop/AnimalBrowserData.js";
import { AnimalAudio } from "./AnimalAudio.js";
import {
  ANIMAL_RECORDINGS,
  ANIMAL_VOICES,
  animalVoiceForSpecies,
  animalVoiceForType,
} from "./AnimalVoice.js";
import { AudioManager } from "./AudioManager.js";

afterEach(() => vi.unstubAllGlobals());

function harness() {
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const sources: {
    buffer: unknown;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    onended: null | (() => void);
  }[] = [];
  const gains: number[] = [],
    pans: number[] = [];
  const ctx = {
    state: "running",
    currentTime: 0,
    destination: node(),
    createBufferSource() {
      const source = {
        ...node(),
        buffer: null as unknown,
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as null | (() => void),
      };
      source.stop.mockImplementation(() => source.onended?.());
      sources.push(source);
      return source;
    },
    createGain: () => ({
      ...node(),
      gain: {
        set value(v: number) {
          gains.push(v);
        },
      },
    }),
    createStereoPanner: () => ({
      ...node(),
      pan: {
        set value(v: number) {
          pans.push(v);
        },
      },
    }),
    decodeAudioData: vi.fn(async () => ({ duration: 1 })),
  };
  const fetcher = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
  vi.stubGlobal("fetch", fetcher);
  const audio = new AnimalAudio(
    ctx as unknown as AudioContext,
    ctx.destination as unknown as AudioNode,
    () => 6,
  );
  const sheep = createFauna("sheep", 120, 0);
  sheep.id = 1;
  const listener = { wx: 0, wy: 0 };
  const pose = (name: string, elapsed = 0) => {
    required(sheep.sprite).clip = required(ENTITY_DEFS[sheep.type]?.sprite?.clips).findIndex(
      (c) => c.name === name,
    );
    required(sheep.sprite).clipElapsedMs = elapsed;
  };
  const flush = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  return { audio, ctx, sources, gains, pans, fetcher, sheep, listener, pose, flush };
}

it("maps recorded browser identities, preserves inheritance and pins every retained source/export", () => {
  const covered = ANIMAL_BROWSER_ENTRIES.filter((a) => animalVoiceForType(a.type));
  expect(covered.map((a) => a.id).sort()).toEqual(
    Object.values(ANIMAL_VOICES)
      .flatMap((v) => v.animals)
      .sort(),
  );
  for (const a of covered) expect(animalVoiceForType(a.type)).toBe(animalVoiceForSpecies(a.id));
  expect(animalVoiceForSpecies("dog-golden")).toBe("dog");
  expect(animalVoiceForSpecies("cat-black")).toBe("cat");
  for (const type of [
    "player",
    "wildlife-tiger-provisional-v1",
    "wildlife-cow-made-up",
    "constructor",
    "wildlife-lion-made-up",
  ])
    expect(animalVoiceForType(type)).toBeUndefined();
  expect(Object.keys(ANIMAL_VOICES).sort()).toEqual(Object.keys(ANIMAL_RECORDINGS).sort());
  expect(receipt.sources.flatMap((s) => s.variants)).toHaveLength(11);
  expect(farmReceipt.sources.flatMap((s) => s.variants)).toHaveLength(5);
  expect(birdReceipt.sources.flatMap((s) => s.variants)).toHaveLength(7);
  expect(gardenReceipt.sources.flatMap((s) => s.variants)).toHaveLength(6);
  const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
  const banks = readdirSync("art-source/animal-audio", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(
      (entry) =>
        JSON.parse(
          readFileSync(`art-source/animal-audio/${entry.name}/manifest.json`, "utf8"),
        ) as typeof receipt,
    );
  expect(banks.flatMap((b) => b.sources.map((s) => s.id)).sort()).toEqual(
    Object.keys(ANIMAL_RECORDINGS).sort(),
  );
  const credits = readFileSync("public/assets/audio/animals/CREDITS.txt", "utf8");
  for (const [bank, source] of banks.flatMap((r) => r.sources.map((s) => [r.id, s] as const))) {
    expect(["CC0-1.0", "CC-BY-3.0", "CC-BY-4.0"]).toContain(source.license);
    expect(credits).toContain(source.sourcePage);
    expect(credits).toContain(source.creator);
    expect(credits).toContain(source.licenseUrl);
    expect(hash(`art-source/animal-audio/${bank}/${source.sourceFile}`)).toBe(source.sha256);
    expect(ANIMAL_RECORDINGS[source.id as keyof typeof ANIMAL_RECORDINGS]).toEqual(
      source.variants.map((v) => v.path),
    );
    for (const variant of source.variants) {
      expect(hash(`public/${variant.path}`)).toBe(variant.sha256);
      expect(variant.peak).toBeLessThan(0.9);
      expect(variant.rms).toBeGreaterThan(0.025);
    }
  }
});

it("admits fresh replicated predator displays, keeps resting hunters quiet and never layers a placeholder", async () => {
  for (const species of ["tiger", "lion", "panther", "brown-bear", "leopard", "jaguar"] as const) {
    const h = harness();
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          Object.assign(this, h.ctx);
        }
      },
    );
    const manager = new AudioManager();
    manager.ensureContext();
    const synthetic = vi.spyOn(manager, "playCreatureCall");
    const hunter = createPredator(species, 20, 0);
    hunter.id = 2;
    const replica = () => [deserializeEntity(serializeEntity(hunter))];
    setPose(hunter, "display");
    manager.updateCreatureCalls(replica(), h.listener, true);
    await h.flush();
    expect(h.sources).toHaveLength(0); // Joining mid-display is silent.
    setPose(hunter, "idle");
    manager.updateCreatureCalls(replica(), h.listener, true);
    h.ctx.currentTime = 100;
    manager.updateCreatureCalls(replica(), h.listener, true);
    await h.flush();
    expect(h.sources).toHaveLength(0);
    setPose(hunter, "display");
    manager.updateCreatureCalls(replica(), h.listener, true);
    await h.flush();
    expect(h.sources).toHaveLength(1);
    expect(h.fetcher).toHaveBeenCalledWith(
      expect.stringContaining(`big-predators-v1/${species === "panther" ? "leopard" : species}-`),
    );
    manager.updateCreatureCalls(replica(), h.listener, true);
    await h.flush();
    expect(h.sources).toHaveLength(1);
    expect(synthetic).not.toHaveBeenCalled();
    manager.stopCreatureCalls();
    expect(manager.creatureAudioDiagnostics.active).toBe(0);
  }
});

it("keeps piglet squeals out of calm ambience and plays only a fresh replicated flee onset", async () => {
  const h = harness(),
    pig = createFauna("piglet", 20, 0);
  pig.id = 2;
  const pose = (name: string) => {
    required(pig.sprite).clip = required(ENTITY_DEFS[pig.type]?.sprite?.clips).findIndex(
      (c) => c.name === name,
    );
    required(pig.sprite).clipElapsedMs = 0;
  };
  pose("idle");
  h.audio.update([pig], h.listener, true);
  h.ctx.currentTime = 100;
  h.audio.update([pig], h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(0);
  pose("flee");
  required(pig.wanderAI).state = "scared";
  const replica = deserializeEntity(serializeEntity(pig));
  h.audio.update([replica], h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(1);
  expect(h.fetcher).toHaveBeenCalledWith(expect.stringContaining("farm-v1/piglet-1.ogg"));
  h.audio.update([replica], h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(1);
  h.audio.stop();
  h.audio.update([replica], h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(1);
});

it.each(["crow", "raven"] as const)(
  "%s keeps its beak quiet while carrying and cancels active or pending calls on pickup",
  async (species) => {
    const h = harness(),
      bird = createFauna(species, 20, 0),
      item = createForageItem(species === "crow" ? "twig" : "shiny", 20, 0);
    bird.id = 2;
    item.id = 3;
    item.parentId = bird.id;
    const replicas = () => [bird, item].map((e) => deserializeEntity(serializeEntity(e)));
    h.audio.update(replicas(), h.listener, true);
    h.ctx.currentTime = 25;
    h.audio.update(replicas(), h.listener, true);
    await h.flush();
    expect(h.sources).toHaveLength(0);
    delete item.parentId;
    h.ctx.currentTime = 50;
    h.audio.update(replicas(), h.listener, true);
    await h.flush();
    expect(h.sources).toHaveLength(1);
    expect(h.fetcher).toHaveBeenCalledWith(expect.stringContaining(`garden-birds-v1/${species}-`));
    item.parentId = bird.id;
    h.audio.update(replicas(), h.listener, true);
    expect(h.audio.diagnostics.active).toBe(0);
    delete item.parentId;
    let resolve!: (v: { ok: boolean; arrayBuffer: () => Promise<ArrayBuffer> }) => void;
    h.fetcher.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    h.ctx.currentTime = 100;
    h.audio.update(replicas(), h.listener, true);
    item.parentId = bird.id;
    h.audio.update(replicas(), h.listener, true);
    resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    await h.flush();
    expect(h.sources).toHaveLength(1);
  },
);

it("uses distinct bird voices only at rest, leaving flight and feeding quiet", async () => {
  const h = harness();
  for (const [index, species] of (["crow", "raven", "pigeon", "dove"] as const).entries()) {
    const bird = createFauna(species, 20, 0);
    bird.id = index + 2;
    const pose = (name: string) => {
      required(bird.sprite).clip = required(ENTITY_DEFS[bird.type]?.sprite?.clips).findIndex(
        (c) => c.name === name,
      );
      expect(bird.sprite?.clip).toBeGreaterThanOrEqual(0);
    };
    h.audio.stop();
    h.ctx.currentTime = index * 100;
    pose("fly");
    h.audio.update([bird], h.listener, true);
    h.ctx.currentTime += 25;
    h.audio.update([bird], h.listener, true);
    await h.flush();
    expect(h.sources).toHaveLength(index);
    pose(species === "raven" ? "bury" : species === "crow" ? "build" : "action");
    h.audio.update([bird], h.listener, true);
    await h.flush();
    expect(h.sources).toHaveLength(index);
    pose("idle");
    h.audio.update([bird], h.listener, true);
    await h.flush();
    expect(h.sources).toHaveLength(index + 1);
    expect(h.fetcher).toHaveBeenCalledWith(
      expect.stringContaining(
        `${species === "dove" ? "garden-v1" : "garden-birds-v1"}/${species}-`,
      ),
    );
  }
});

it("admits resting goat/donkey calls but keeps a dust-bathing donkey quiet", async () => {
  const h = harness(),
    goat = createFauna("goat", 20, 0),
    donkey = createFauna("donkey", 20, 0);
  goat.id = 2;
  donkey.id = 3;
  h.audio.update([goat], h.listener, true);
  h.ctx.currentTime = 25;
  h.audio.update([goat], h.listener, true);
  await h.flush();
  expect(h.fetcher).toHaveBeenCalledWith(expect.stringContaining("farm-v1/goat-"));
  h.audio.stop();
  required(donkey.sprite).clip = required(ENTITY_DEFS[donkey.type]?.sprite?.clips).findIndex(
    (c) => c.name === "roll",
  );
  expect(donkey.sprite?.clip).toBeGreaterThan(0);
  h.audio.update([donkey], h.listener, true);
  h.ctx.currentTime = 100;
  h.audio.update([donkey], h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(1);
  required(donkey.sprite).clip = 0;
  h.audio.update([donkey], h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(2);
  expect(h.fetcher).toHaveBeenCalledWith(expect.stringContaining("farm-v1/donkey-"));
});

it("plays an actual replicated bleat onset once, spatially, and never replays a late join or rapid repeat", async () => {
  const h = harness();
  h.audio.update([h.sheep], h.listener, true);
  h.pose("bleat");
  const replica = deserializeEntity(serializeEntity(h.sheep));
  h.audio.update([replica], h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(1);
  expect(h.gains[0]).toBeCloseTo(0.32 * 0.6 ** 2);
  expect(h.pans[0]).toBe(0.5);
  h.audio.update([replica], h.listener, true);
  await h.flush();
  h.pose("idle");
  h.audio.update([h.sheep], h.listener, true);
  h.pose("bleat");
  h.audio.update([h.sheep], h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(1);
  h.ctx.currentTime = 10;
  h.pose("idle");
  h.audio.update([h.sheep], h.listener, true);
  h.pose("bleat", 900);
  h.audio.update([h.sheep], h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(1);
  h.audio.update([], h.listener, true);
  expect(h.sources[0]?.stop).toHaveBeenCalledOnce();
  h.pose("bleat");
  h.audio.update([h.sheep], h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(1);
});

it("spreads sparse ambient calls, chooses nearby actors, bounds voices, stops on range/pause and does not burst on resume", async () => {
  const h = harness();
  const herd = Array.from({ length: 20 }, (_, i) => {
    const a = createFauna("cow", 280 - i * 10, 0);
    a.id = i + 1;
    return a;
  });
  h.audio.update(herd, h.listener, true);
  h.ctx.currentTime = 25;
  h.audio.update(herd, h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(1);
  for (let i = 0; i < 50; i++) h.audio.update(herd, h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(1);
  expect(h.pans[0]).toBeCloseTo(90 / 240);
  h.audio.update(herd, { wx: -500, wy: 0 }, true);
  expect(h.audio.diagnostics.active).toBe(0);
  h.ctx.currentTime = 100;
  h.audio.update(herd, h.listener, false);
  h.audio.update(herd, h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(1);
  h.audio.update([], h.listener, true);
  expect(h.audio.diagnostics.active).toBe(0);
});

it.each(["pause", "remove", "range", "pose", "suspended"])(
  "cancels a decoded request after %s",
  async (reason) => {
    const h = harness();
    let resolve!: (v: { ok: boolean; arrayBuffer: () => Promise<ArrayBuffer> }) => void;
    h.fetcher.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    h.audio.update([h.sheep], h.listener, true);
    h.pose("bleat");
    h.audio.update([h.sheep], h.listener, true);
    if (reason === "suspended") h.ctx.state = "suspended";
    if (reason === "pose") h.pose("idle");
    h.audio.update(
      reason === "remove" ? [] : [h.sheep],
      reason === "range" ? { wx: -500, wy: 0 } : h.listener,
      reason !== "pause",
    );
    resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    await h.flush();
    expect(h.sources).toHaveLength(0);
  },
);

it("deduplicates loads, rotates real takes, drops stale auditions and respects stop/dispose epoch", async () => {
  const h = harness();
  await h.audio.audition("dog");
  await h.audio.audition("dog");
  await h.audio.audition("dog");
  await h.audio.audition("dog");
  expect(h.fetcher).toHaveBeenCalledTimes(3);
  expect(h.sources).toHaveLength(4);
  expect(h.audio.diagnostics.active).toBe(1);
  h.audio.stop();
  expect(h.audio.diagnostics.active).toBe(0);
  const a = h.audio.audition("cat"),
    b = h.audio.audition("sheep");
  expect(await a).toBe(false);
  expect(await b).toBe(true);
  const pending = h.audio.audition("horse");
  h.audio.stop();
  expect(await pending).toBe(false);
});

it("keeps the combined recorded/synthesized voice budget at six even when many action loads resolve together", async () => {
  const h = harness();
  vi.stubGlobal(
    "AudioContext",
    class {
      constructor() {
        Object.assign(this, h.ctx);
      }
    },
  );
  const manager = new AudioManager();
  manager.ensureContext();
  const herd = Array.from({ length: 20 }, (_, i) => {
    const a = createFauna("sheep", i, 0);
    a.id = i + 1;
    return a;
  });
  manager.updateCreatureCalls(herd, h.listener, true);
  for (const a of herd) {
    required(a.sprite).clip = required(ENTITY_DEFS[a.type]?.sprite?.clips).findIndex(
      (c) => c.name === "bleat",
    );
    required(a.sprite).clipElapsedMs = 0;
  }
  manager.updateCreatureCalls(herd, h.listener, true);
  await h.flush();
  expect(manager.creatureAudioDiagnostics).toEqual({ active: 6, played: 6 });
  manager.playCreatureCall(500, "rex", 0.15, 0);
  expect(manager.creatureAudioDiagnostics.active).toBe(6);
  manager.stopCreatureCalls();
  expect(manager.creatureAudioDiagnostics.active).toBe(0);
});

it("selects the configured owl hoot ahead of its raptor locomotion kind", () => {
  const spy = vi.spyOn(AudioManager.prototype, "playCreatureCall").mockReturnValue(true);
  const audio = new AudioManager();
  const owl = {
    id: 1,
    type: "wildlife-owl-predator-v1",
    position: { wx: 0, wy: 0 },
    sprite: { clip: 3, clipElapsedMs: 0 },
  };
  audio.updateCreatureCalls([owl as ReturnType<typeof createFauna>], { wx: 0, wy: 0 }, true);
  expect(spy).toHaveBeenCalledWith(1, "owl", 0.15, 0);
  spy.mockRestore();
});

it.each(["dog-golden", "dog-shepherd"] as const)(
  "%s barks for a real replicated fetch drop without requiring a missing release clip",
  async (species) => {
    const h = harness(),
      dog = createFauna(species, 20, 0),
      player = createPlayer(0, 0),
      ball = createBall(24, 0);
    dog.id = 2;
    player.id = 3;
    ball.id = 4;
    ball.parentId = dog.id;
    const replica = () => [dog, player, ball].map((e) => deserializeEntity(serializeEntity(e)));
    expect(ENTITY_DEFS[dog.type]?.sprite?.clips?.some((c) => c.name === "release")).toBe(false);
    h.audio.update(replica(), h.listener, true);
    delete ball.parentId;
    h.audio.update(replica(), h.listener, true);
    await h.flush();
    expect(h.sources).toHaveLength(1);
    h.audio.update(replica(), h.listener, true);
    await h.flush();
    expect(h.sources).toHaveLength(1);
  },
);

it.each(["deleted", "transferred", "far", "alarm"])(
  "does not mistake a %s carried ball for a returned toy",
  async (reason) => {
    const h = harness(),
      dog = createFauna("dog-golden", 20, 0),
      player = createPlayer(0, 0),
      ball = createBall(24, 0);
    dog.id = 2;
    player.id = 3;
    ball.id = 4;
    ball.parentId = dog.id;
    h.audio.update([dog, player, ball], h.listener, true);
    delete ball.parentId;
    if (reason === "transferred") ball.parentId = 99;
    if (reason === "far") ball.position.wx = 200;
    if (reason === "alarm") required(dog.wanderAI).state = "scared";
    h.audio.update(reason === "deleted" ? [dog, player] : [dog, player, ball], h.listener, true);
    await h.flush();
    expect(h.sources).toHaveLength(0);
  },
);

it("does not replay a carry/drop across a scene reset with reused actor IDs", async () => {
  const h = harness(),
    dog = createFauna("dog-golden", 20, 0),
    player = createPlayer(0, 0),
    ball = createBall(24, 0);
  dog.id = 2;
  player.id = 3;
  ball.id = 4;
  ball.parentId = dog.id;
  h.audio.update([dog, player, ball], h.listener, true);
  h.audio.stop();
  delete ball.parentId;
  h.audio.update([dog, player, ball], h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(0);
});

function setPose(actor: ReturnType<typeof createFauna>, name: string, moving = false) {
  required(actor.sprite).clip = required(ENTITY_DEFS[actor.type]?.sprite?.clips).findIndex(
    (c) => c.name === name,
  );
  expect(actor.sprite?.clip).toBeGreaterThanOrEqual(0);
  required(actor.sprite).moving = moving;
}

it("buzzes only for replicated bee flight and stops immediately on flower contact", async () => {
  const h = harness(),
    bee = createFauna("bee", 20, 0);
  bee.id = 2;
  const replicas = () => [deserializeEntity(serializeEntity(bee))];
  h.audio.update(replicas(), h.listener, true);
  h.ctx.currentTime = 25;
  setPose(bee, "sip");
  h.audio.update(replicas(), h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(0);
  setPose(bee, "fly", true);
  h.audio.update(replicas(), h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(1);
  expect(h.fetcher).toHaveBeenCalledWith(expect.stringContaining("garden-v1/bee-"));
  setPose(bee, "sip");
  h.audio.update(replicas(), h.listener, true);
  expect(h.sources[0]?.stop).toHaveBeenCalledOnce();
  expect(h.audio.diagnostics.active).toBe(0);
  h.ctx.currentTime = 50;
  setPose(bee, "fly"); // A named clip alone cannot establish movement.
  h.audio.update(replicas(), h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(1);
});

it("does not start a pending buzz after landing and taking off again", async () => {
  const h = harness(),
    bee = createFauna("bee", 20, 0);
  bee.id = 2;
  let resolve!: (v: { ok: boolean; arrayBuffer: () => Promise<ArrayBuffer> }) => void;
  h.fetcher.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  setPose(bee, "fly", true);
  h.audio.update([bee], h.listener, true);
  setPose(bee, "sip");
  h.audio.update([bee], h.listener, true);
  setPose(bee, "fly", true);
  h.audio.update([bee], h.listener, true);
  resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  await h.flush();
  expect(h.sources).toHaveLength(0);
});

it("spaces cricket groups by twelve seconds and stops chirping when they hop", async () => {
  const h = harness();
  const group = Array.from({ length: 20 }, (_, i) => {
    const a = createFauna("cricket", 200 - i * 5, 0);
    a.id = i + 1;
    return a;
  });
  h.audio.update(group, h.listener, true);
  h.ctx.currentTime = 25;
  h.audio.update(group, h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(1);
  expect(h.pans[0]).toBeCloseTo(105 / 240);
  h.sources[0]?.onended?.();
  h.ctx.currentTime = 28;
  h.audio.update(group, h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(1);
  h.ctx.currentTime = 37;
  h.audio.update(group, h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(2);
  for (const a of group) setPose(a, "hop", true);
  h.audio.update(group, h.listener, true);
  expect(h.audio.diagnostics.active).toBe(0);
});

it("shares one insect emitter between bee buzz and cricket calls and releases it on removal", async () => {
  const h = harness(),
    cricket = createFauna("cricket", 20, 0),
    bee = createFauna("bee", 10, 0);
  cricket.id = 2;
  bee.id = 3;
  h.audio.update([cricket], h.listener, true);
  h.ctx.currentTime = 25;
  h.audio.update([cricket], h.listener, true);
  await h.flush();
  setPose(bee, "fly", true);
  h.ctx.currentTime = 28;
  h.audio.update([bee, cricket], h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(1);
  h.audio.update([bee], h.listener, true); // Retire the cricket and its emitter slot.
  h.audio.update([bee], h.listener, true);
  await h.flush();
  expect(h.sources).toHaveLength(2);
  expect(h.audio.diagnostics.active).toBe(1);
  h.audio.stop();
  expect(h.audio.diagnostics.active).toBe(0);
});
