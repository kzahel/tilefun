import { afterEach, expect, it, vi } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { ENTITY_DEFS } from "../entities/EntityDefs.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { createFrog } from "../wildlife/Frog.js";
import { createMallard } from "../wildlife/Mallard.js";
import { createRobin } from "../wildlife/Robin.js";
import { animalAuditionLabel, animalSoundCoverage } from "./AnimalVoice.js";
import { AudioManager } from "./AudioManager.js";
import { creatureCallSamples } from "./CreatureCall.js";
import { SMALL_ANIMAL_CALLS } from "./SmallAnimalCall.js";

afterEach(() => vi.unstubAllGlobals());

function harness() {
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const sources: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
  }[] = [];
  const gains: { value: number }[] = [],
    pans: { value: number }[] = [];
  const ctx = {
    state: "running",
    currentTime: 0,
    sampleRate: 8000,
    destination: node(),
    resume: vi.fn(async () => {
      ctx.state = "running";
    }),
    createGain: () => {
      const gain = { value: 1 };
      gains.push(gain);
      return { ...node(), gain };
    },
    createStereoPanner: () => {
      const pan = { value: 0 };
      pans.push(pan);
      return { ...node(), pan };
    },
    createBuffer: (_n: number, size: number) => {
      const data = new Float32Array(size);
      return { getChannelData: () => data };
    },
    decodeAudioData: vi.fn(async () => ({ duration: 1 })),
    createBufferSource: () => {
      const source = {
        ...node(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
      source.stop.mockImplementation(() => source.onended?.());
      sources.push(source);
      return source;
    },
  };
  vi.stubGlobal("AudioContext", function MockAudioContext() {
    return ctx;
  });
  const audio = new AudioManager();
  audio.ensureContext();
  const listener = { wx: 0, wy: 0 };
  const actor = createRobin(120, 0);
  actor.id = 1;
  const update = (entities = [actor], enabled = true, position = listener) =>
    audio.updateCreatureCalls(
      entities.map((e) => deserializeEntity(serializeEntity(e))),
      position,
      enabled,
    );
  const pose = (a: typeof actor, name: string, age = 0) => {
    required(a.sprite).clip = required(ENTITY_DEFS[a.type]?.sprite?.clips).findIndex(
      (p) => p.name === name,
    );
    expect(a.sprite?.clip).toBeGreaterThanOrEqual(0);
    required(a.sprite).clipElapsedMs = age;
  };
  return { audio, ctx, sources, gains, pans, actor, update, pose };
}

it.each(["robin", "frog", "duck"] as const)(
  "%s retains a short distinct, finite synthesized contour",
  (kind) => {
    const samples = creatureCallSamples(kind, 8000),
      duration = kind === "robin" ? 0.36 : kind === "frog" ? 0.32 : 0.21;
    expect(samples).toHaveLength(Math.ceil(8000 * duration));
    expect(Math.abs(samples[0] ?? NaN)).toBe(0);
    expect(Math.abs(samples.at(-1) ?? NaN)).toBe(0);
    expect(samples.every((s) => Number.isFinite(s) && Math.abs(s) <= 1)).toBe(true);
    expect(samples.reduce((sum, v) => sum + v * v, 0)).toBeGreaterThan(1);
  },
);

it("classifies the three legacy entries as shared synthesis and exposes accurate audition labels", () => {
  for (const p of SMALL_ANIMAL_CALLS) {
    expect(animalSoundCoverage(p.type)).toBe("synthesized");
    expect(animalAuditionLabel(p.species)).toBe(p.label);
  }
  expect(animalAuditionLabel("constructor")).toBeUndefined();
});

it.each([createRobin, createFrog, createMallard])(
  "plays one replicated action onset and a later alarm without replaying first snapshots",
  (create) => {
    const h = harness(),
      a = create(120, 0);
    a.id = 1;
    h.pose(a, "action");
    h.update([a]);
    expect(h.sources).toHaveLength(0);
    h.pose(a, "idle");
    h.update([a]);
    h.pose(a, "action");
    h.update([a]);
    h.update([a]);
    expect(h.sources).toHaveLength(1);
    expect(h.gains.at(-1)?.value).toBeCloseTo(
      (a.type.includes("robin") ? 0.1 : a.type.includes("frog") ? 0.18 : 0.25) * 0.6 ** 2,
    );
    expect(h.pans.at(-1)?.value).toBe(0.5);
    // A new alarm can interrupt a committed hop whose animation is already old.
    h.ctx.currentTime = 3;
    h.pose(a, a.type.includes("mallard") ? "waddle" : "hop", 700);
    h.update([a]);
    required(a.wanderAI).state = "scared";
    h.update([a]);
    h.update([a]);
    expect(h.sources).toHaveLength(2);
    h.audio.stopCreatureCalls();
    h.update([a]);
    expect(h.sources).toHaveLength(2);
  },
);

it("rejects stale, muted, dead and carried action starts and releases voices on range/removal", () => {
  const h = harness();
  h.update();
  h.pose(h.actor, "action", 500);
  h.update();
  expect(h.sources).toHaveLength(0);
  h.pose(h.actor, "idle");
  h.update(undefined, false);
  h.pose(h.actor, "action");
  h.update(undefined, false);
  h.update();
  expect(h.sources).toHaveLength(0);
  h.pose(h.actor, "idle");
  h.update();
  h.actor.parentId = 99;
  h.pose(h.actor, "action");
  h.update();
  delete h.actor.parentId;
  h.update();
  expect(h.sources).toHaveLength(0);
  h.pose(h.actor, "idle");
  h.update();
  h.actor.deathTimer = 1;
  h.pose(h.actor, "action");
  h.update();
  delete h.actor.deathTimer;
  h.update();
  expect(h.sources).toHaveLength(0);
  h.pose(h.actor, "idle");
  h.update();
  h.pose(h.actor, "action");
  h.update();
  expect(h.sources).toHaveLength(1);
  h.update(undefined, true, { wx: -500, wy: 0 });
  expect(h.audio.creatureAudioDiagnostics.active).toBe(0);
  h.ctx.currentTime = 3;
  h.pose(h.actor, "idle");
  h.update();
  h.pose(h.actor, "action");
  h.update();
  h.update([]);
  expect(h.audio.creatureAudioDiagnostics.active).toBe(0);
  h.update();
  expect(h.sources).toHaveLength(2);
});

it("bounds simultaneous flock alarms at six, chooses nearby actors and prevents rapid retriggers", () => {
  const h = harness(),
    flock = Array.from({ length: 20 }, (_, i) => {
      const a = createRobin(220 - i * 10, 0);
      a.id = i + 1;
      return a;
    });
  h.update(flock);
  for (const a of flock) required(a.wanderAI).state = "scared";
  h.update(flock);
  expect(h.sources).toHaveLength(6);
  expect(h.pans[0]?.value).toBeCloseTo(30 / 240);
  for (const source of h.sources) source.onended?.();
  const speakers = flock.slice(-6);
  for (const a of speakers) required(a.wanderAI).state = "idle";
  h.update(speakers);
  for (const a of speakers) required(a.wanderAI).state = "scared";
  h.update(speakers);
  expect(h.sources).toHaveLength(6);
  h.ctx.currentTime = 3;
  for (const a of speakers) required(a.wanderAI).state = "idle";
  h.update(speakers);
  for (const a of speakers) required(a.wanderAI).state = "scared";
  h.update(speakers);
  expect(h.sources).toHaveLength(12);
  expect(h.audio.playCreatureCall(500, "rex", 0.2, 0)).toBe(false);
  h.audio.stopCreatureCalls();
  expect(h.audio.creatureAudioDiagnostics.active).toBe(0);
});

it("supersedes pending recorded auditions with synthesis and cancels suspended auditions on stop", async () => {
  const h = harness();
  let resolve!: (v: { ok: boolean; arrayBuffer: () => Promise<ArrayBuffer> }) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    ),
  );
  const recording = h.audio.auditionAnimalVoice("cat");
  expect(await h.audio.auditionAnimalVoice("robin")).toBe(true);
  resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) });
  expect(await recording).toBe(false);
  expect(h.sources).toHaveLength(1);
  h.ctx.state = "suspended";
  let resumed!: () => void;
  h.ctx.resume.mockImplementation(
    () =>
      new Promise<void>((r) => {
        resumed = () => {
          h.ctx.state = "running";
          r();
        };
      }),
  );
  const pending = h.audio.auditionAnimalVoice("frog");
  h.audio.stopCreatureCalls();
  resumed();
  expect(await pending).toBe(false);
  expect(h.audio.creatureAudioDiagnostics.active).toBe(0);
});
