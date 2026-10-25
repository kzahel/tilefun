import { afterEach, expect, it, vi } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createTrain } from "../railway/Train.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { AudioManager } from "./AudioManager.js";

function harness() {
  const param = () => ({ value: 0, setTargetAtTime: vi.fn() });
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const gains: ReturnType<typeof param>[] = [];
  const sources: (ReturnType<typeof node> & {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    playbackRate: ReturnType<typeof param>;
    loop: boolean;
    onended?: () => void;
  })[] = [];
  const buffers: Float32Array[] = [];
  const ctx = {
    state: "running",
    sampleRate: 8000,
    currentTime: 10,
    destination: node(),
    close: vi.fn().mockResolvedValue(undefined),
    createGain() {
      const gain = param();
      gains.push(gain);
      return { ...node(), gain };
    },
    createBuffer(_channels: number, length: number) {
      const data = new Float32Array(length);
      buffers.push(data);
      return { getChannelData: () => data };
    },
    createBufferSource() {
      const source = {
        ...node(),
        start: vi.fn(),
        stop: vi.fn(),
        playbackRate: param(),
        loop: false,
      };
      sources.push(source);
      return source;
    },
  };
  vi.stubGlobal(
    "AudioContext",
    class {
      constructor() {
        Object.setPrototypeOf(this, ctx);
      }
    },
  );
  return { audio: new AudioManager(), ctx, gains, sources, buffers };
}
afterEach(() => vi.unstubAllGlobals());

it("keeps one quiet engine, smoothly follows speed/reverse, and uses a lower heavy-vehicle pitch", () => {
  const { audio, sources, gains, buffers } = harness();
  const car = createVehicle("compact-1", 0, 0);
  car.id = 7;
  audio.updateCarEngine(car, true);
  expect(sources).toHaveLength(0); // Never creates or unlocks a context from an update.
  audio.ensureContext();
  audio.updateCarEngine(undefined, true);
  expect(sources).toHaveLength(0);
  audio.updateCarEngine(car, true);
  audio.updateCarEngine(car, true);
  expect(sources).toHaveLength(1);
  expect(sources[0]?.loop).toBe(true);
  expect(gains[1]?.setTargetAtTime).toHaveBeenLastCalledWith(0.025, 10, 0.08);
  expect(sources[0]?.playbackRate.setTargetAtTime).toHaveBeenLastCalledWith(0.85, 10, 0.12);
  car.velocity = { vx: -179.2, vy: 0 };
  audio.updateCarEngine(car, true);
  expect(sources[0]?.playbackRate.setTargetAtTime.mock.lastCall?.[0]).toBeCloseTo(1.85);
  expect(gains[1]?.setTargetAtTime.mock.lastCall?.[0]).toBeCloseTo(0.06);
  car.velocity.vx = 10000;
  audio.updateCarEngine(car, true);
  expect(gains[1]?.setTargetAtTime.mock.lastCall?.[0]).toBeCloseTo(0.06);
  expect(sources).toHaveLength(1);
  const bus = createVehicle("bus-1", 0, 0);
  bus.id = 8;
  audio.updateCarEngine(bus, true);
  expect(sources[0]?.stop).toHaveBeenCalledWith(10.08);
  expect(sources[1]?.playbackRate.setTargetAtTime).toHaveBeenLastCalledWith(0.7, 10, 0.12);
  expect(buffers).toHaveLength(1); // Reuse original synthesis across vehicles.
  const data = required(buffers[0]);
  expect(data.every(Number.isFinite)).toBe(true);
  const rms = Math.sqrt(data.reduce((sum, n) => sum + n * n, 0) / data.length);
  expect(rms).toBeGreaterThan(0.1);
  expect(rms * 0.06).toBeLessThan(0.02); // Keep normal listening level subtle.
  expect(Math.abs(data.reduce((sum, n) => sum + n, 0) / data.length)).toBeLessThan(0.00001);
  expect(Math.abs((data[1] ?? 0) + (data.at(-1) ?? 0))).toBeLessThan(0.001); // Smooth periodic seam.
});

it("fades and releases the voice on exit, pause, focus loss, suspended audio and disposal", () => {
  const { audio, ctx, sources, buffers } = harness();
  audio.ensureContext();
  const car = createVehicle("compact-1", 0, 0);
  car.id = 1;
  const stops = [
    () => audio.updateCarEngine(undefined, true),
    () => audio.updateCarEngine(car, false),
    () => audio.stopCarEngine(),
    () => {
      ctx.state = "suspended";
      audio.updateCarEngine(car, true);
    },
    () => audio.updateCarEngine({ ...car, type: "vehicle-v1:explorer-boat" }, true),
    () => audio.updateCarEngine(createTrain(0, 0), true),
    () => audio.dispose(),
  ];
  for (const stop of stops) {
    ctx.state = "running";
    audio.updateCarEngine(car, true);
    const voice = required(sources.at(-1));
    stop();
    expect(voice.stop).toHaveBeenCalledWith(10.08);
    voice.onended?.();
    expect(voice.disconnect).toHaveBeenCalledOnce();
  }
  expect(buffers).toHaveLength(1);
  expect(ctx.close).toHaveBeenCalledOnce();
});
