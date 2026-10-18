import { afterEach, expect, it, vi } from "vitest";
import { createVehicle } from "../traffic/Vehicle.js";
import { AudioManager } from "./AudioManager.js";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it.each(["ambulance", "fire-truck-ladder-1", "police-car", "fire-truck-ladder-2"])(
  "%s keeps one spatial looping voice, changes style, and stops for quiet/off/range/pause",
  (model) => {
    const sources: {
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      loop: boolean;
    }[] = [];
    const buffers: Float32Array[] = [];
    const param = () => ({ value: 0, setTargetAtTime: vi.fn() });
    const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
    vi.stubGlobal(
      "AudioContext",
      class {
        state = "running";
        currentTime = 10;
        sampleRate = 8000;
        destination = node();
        createGain() {
          return { ...node(), gain: param() };
        }
        createStereoPanner() {
          return { ...node(), pan: param() };
        }
        createBuffer(_channels: number, length: number) {
          const data = new Float32Array(length);
          buffers.push(data);
          return { getChannelData: () => data };
        }
        createBufferSource() {
          const source = { ...node(), start: vi.fn(), stop: vi.fn(), loop: false };
          sources.push(source);
          return source;
        }
      },
    );
    const audio = new AudioManager();
    audio.ensureContext();
    // Even a malformed siren bit pattern on work vehicles cannot allocate audio.
    const silent = ["garbage-truck-green", "garbage-truck-orange"].map((model) =>
      createVehicle(model, 0, 0),
    );
    for (const car of silent) car.emergencyState = 5;
    audio.updateSirens(silent, { wx: 0, wy: 0 }, true);
    expect(sources).toHaveLength(0);
    const car = createVehicle(model, 0, 0);
    car.id = 1;
    car.emergencyState = 3;
    const listener = { wx: 0, wy: 0 };
    audio.updateSirens([car], listener, true);
    audio.updateSirens([car], listener, true);
    expect(sources).toHaveLength(1);
    expect(sources[0]?.loop).toBe(true);
    car.emergencyState = 5;
    audio.updateSirens([car], listener, true);
    expect(sources[0]?.stop).toHaveBeenCalled();
    expect(buffers).toHaveLength(2);
    expect(buffers[0]).not.toEqual(buffers[1]);
    car.emergencyState = 1;
    audio.updateSirens([car], listener, true);
    expect(sources[1]?.stop).toHaveBeenCalled();
    car.emergencyState = 3;
    audio.updateSirens([car], listener, true);
    expect(buffers).toHaveLength(2); // cached synthesis
    audio.updateSirens([car], { wx: 900, wy: 0 }, true);
    expect(sources[2]?.stop).toHaveBeenCalled();
    audio.updateSirens([car], listener, true);
    audio.updateSirens([car], listener, false);
    expect(sources[3]?.stop).toHaveBeenCalled();
    car.emergencyState = 2;
    audio.updateSirens([car], listener, true);
    expect(sources).toHaveLength(4);
  },
);

it("plays distinct spatial car, heavy and train horns and sustains voices until release or a lost heartbeat", () => {
  vi.useFakeTimers();
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const param = () => ({ value: 0, setTargetAtTime: vi.fn() });
  const voices: {
    frequency: ReturnType<typeof param>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    onended?: () => void;
  }[] = [];
  const gains: ReturnType<typeof param>[] = [],
    pans: ReturnType<typeof param>[] = [];
  vi.stubGlobal(
    "AudioContext",
    class {
      state = "running";
      currentTime = 10;
      destination = node();
      createGain() {
        const gain = param();
        gains.push(gain);
        return { ...node(), gain };
      }
      createStereoPanner() {
        const pan = param();
        pans.push(pan);
        return { ...node(), pan };
      }
      createOscillator() {
        const voice = { ...node(), frequency: param(), start: vi.fn(), stop: vi.fn() };
        voices.push(voice);
        return voice;
      }
    },
  );
  const audio = new AudioManager(),
    listener = { wx: 0, wy: 0 };
  audio.playVehicleHorn(
    { type: "vehicle-horn", vehicleId: 1, active: true, wx: 0, wy: 0, kind: "car" },
    listener,
  );
  expect(voices).toHaveLength(0);
  audio.ensureContext();
  audio.playVehicleHorn(
    { type: "vehicle-horn", vehicleId: 1, active: true, wx: 800, wy: 0, kind: "car" },
    listener,
  );
  expect(voices).toHaveLength(0);
  for (const [vehicleId, kind] of (["car", "heavy", "train"] as const).entries())
    audio.playVehicleHorn(
      { type: "vehicle-horn", vehicleId, active: true, wx: 250, wy: 0, kind },
      listener,
    );
  expect(voices.map((v) => v.frequency.value)).toEqual([350, 440, 155, 196, 440, 554, 660]);
  expect(pans.map((p) => p.value)).toEqual([0.5, 0.5, 0.5]);
  expect(gains[1]?.setTargetAtTime.mock.calls[0]?.[0]).toBeCloseTo(0.04);
  expect(voices.every((v) => v.stop.mock.calls.length === 0)).toBe(true);
  // Holding past the old duration renews the same oscillators without retriggering.
  for (let i = 0; i < 20; i++) {
    vi.advanceTimersByTime(200);
    audio.playVehicleHorn(
      { type: "vehicle-horn", vehicleId: 0, active: true, wx: 100, wy: 0, kind: "car" },
      listener,
    );
  }
  expect(voices).toHaveLength(7);
  expect(voices[0]?.stop).not.toHaveBeenCalled();
  expect(voices[2]?.stop).toHaveBeenCalled(); // Unrefreshed heavy/train voices expire.
  audio.playVehicleHorn(
    { type: "vehicle-horn", vehicleId: 0, active: false, wx: 100, wy: 0, kind: "car" },
    listener,
  );
  expect(voices[0]?.stop).toHaveBeenCalledWith(10.06);
  audio.stopHorns();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
  for (const voice of voices) {
    voice.onended?.();
    expect(voice.disconnect).toHaveBeenCalled();
  }
});
