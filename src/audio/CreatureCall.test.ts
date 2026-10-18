import { afterEach, describe, expect, it, vi } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createPredator } from "../wildlife/Predator.js";
import { AudioManager } from "./AudioManager.js";
import { creatureCallSamples } from "./CreatureCall.js";

afterEach(() => vi.unstubAllGlobals());

describe("creature calls", () => {
  it.each(["rex", "dragon", "wolf", "griffin", "spider", "coyote", "hyena", "cat"] as const)(
    "%s has a bounded finite call with quiet edges",
    (kind) => {
      const samples = creatureCallSamples(kind, 8000);
      expect(samples.length).toBe(10240);
      expect([...samples].every((v) => Number.isFinite(v) && Math.abs(v) <= 1)).toBe(true);
      expect(samples[0]).toBe(0);
      expect(Math.abs(samples.at(-1) ?? 1)).toBeLessThan(0.01);
      expect(Math.sqrt(samples.reduce((n, v) => n + v * v, 0) / samples.length)).toBeGreaterThan(
        0.05,
      );
    },
  );
  it.each([
    "t-rex",
    "wolf",
    "coyote",
    "spotted-hyena",
    "jaguar",
    "leopard",
    "cheetah",
    "lynx",
    "bobcat",
  ] as const)(
    "%s plays one spatial call per display, suppresses late/muted calls and stops on pause/removal",
    (species) => {
      const sources: {
        start: ReturnType<typeof vi.fn>;
        stop: ReturnType<typeof vi.fn>;
        onended: (() => void) | null;
      }[] = [];
      const connection = () => ({ connect: vi.fn(), disconnect: vi.fn() });
      class Context {
        state = "running";
        sampleRate = 8000;
        destination = {};
        createGain() {
          return { ...connection(), gain: { value: 1 } };
        }
        createStereoPanner() {
          return { ...connection(), pan: { value: 0 } };
        }
        createBuffer(_channels: number, length: number) {
          return { getChannelData: () => new Float32Array(length) };
        }
        createBufferSource() {
          const source = {
            ...connection(),
            buffer: null,
            start: vi.fn(),
            stop: vi.fn(),
            onended: null as (() => void) | null,
          };
          source.stop.mockImplementation(() => source.onended?.());
          sources.push(source);
          return source;
        }
      }
      vi.stubGlobal("AudioContext", Context);
      const audio = new AudioManager();
      audio.ensureContext();
      const rex = createPredator(species, 64, 0);
      rex.id = 1;
      required(rex.sprite).clip = 3;
      required(rex.sprite).clipElapsedMs = 0;
      for (let i = 0; i < 10; i++) audio.updateCreatureCalls([rex], { wx: 0, wy: 0 }, true);
      expect(sources).toHaveLength(1);
      expect(audio.creatureAudioDiagnostics).toEqual({ played: 1, active: 1 });
      audio.updateCreatureCalls([rex], { wx: 0, wy: 0 }, false);
      expect(sources[0]?.stop).toHaveBeenCalledOnce();
      expect(audio.creatureAudioDiagnostics.active).toBe(0);
      audio.updateCreatureCalls([rex], { wx: 0, wy: 0 }, true);
      expect(sources).toHaveLength(1);
      required(rex.sprite).clip = 0;
      audio.updateCreatureCalls([rex], { wx: 0, wy: 0 }, true);
      required(rex.sprite).clip = 3;
      required(rex.sprite).clipElapsedMs = 900;
      audio.updateCreatureCalls([rex], { wx: 0, wy: 0 }, true);
      expect(sources).toHaveLength(1);
      audio.updateCreatureCalls([], { wx: 0, wy: 0 }, true);
      required(rex.sprite).clipElapsedMs = 0;
      audio.updateCreatureCalls([rex], { wx: 0, wy: 0 }, true);
      expect(sources).toHaveLength(2);
      audio.updateCreatureCalls([], { wx: 0, wy: 0 }, true);
      expect(sources[1]?.stop).toHaveBeenCalledOnce();
      expect(audio.creatureAudioDiagnostics.active).toBe(0);
    },
  );
});
