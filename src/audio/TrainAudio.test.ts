import { afterEach, expect, it, vi } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createTrain, createTrainCarriages } from "../railway/Train.js";
import { AudioManager } from "./AudioManager.js";

function audioHarness() {
  const sources: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    loop: boolean;
    playbackRate: ReturnType<typeof param>;
    onended?: () => void;
  }[] = [];
  const gains: ReturnType<typeof param>[] = [];
  const pans: ReturnType<typeof param>[] = [];
  const buffers: Float32Array[] = [];
  const param = () => ({ value: 0, setTargetAtTime: vi.fn() });
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const ctx = {
    state: "running",
    currentTime: 10,
    sampleRate: 8000,
    destination: node(),
    createGain() {
      const gain = param();
      gains.push(gain);
      return { ...node(), gain };
    },
    createStereoPanner() {
      const pan = param();
      pans.push(pan);
      return { ...node(), pan };
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
        loop: false,
        playbackRate: param(),
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
  const audio = new AudioManager();
  return { audio, ctx, sources, gains, pans, buffers };
}
afterEach(() => vi.unstubAllGlobals());

it("unlocks lazily and gives a whole moving consist one speed-matched rhythm and double whistle", () => {
  const { audio, sources, ctx, buffers, gains, pans } = audioHarness();
  const cars = createTrainCarriages(0, 0, [0, 0, 0]);
  cars.forEach((car, i) => {
    car.id = i + 1;
    car.velocity = { vx: 90, vy: 0 };
  });
  const listener = { wx: 0, wy: 0 };
  audio.updateTrains(cars, listener, true);
  expect(sources).toHaveLength(0);
  audio.ensureContext();
  audio.updateTrains(cars, listener, true);
  audio.updateTrains(cars, listener, true);
  expect(sources).toHaveLength(2);
  expect(sources.map((s) => s.loop)).toEqual([true, false]);
  expect(sources[0]?.playbackRate.setTargetAtTime).toHaveBeenLastCalledWith(1, 10, 0.08);
  expect(gains[1]?.setTargetAtTime).toHaveBeenLastCalledWith(0.24, 10, 0.03);
  for (const data of buffers) {
    expect(data.every(Number.isFinite)).toBe(true);
    expect(Math.max(...data)).toBeGreaterThan(0.1);
    expect(Math.max(...data.map(Math.abs))).toBeLessThan(1);
    expect(data[0]).toBe(0);
    expect(Math.abs(data[data.length - 1] ?? 0)).toBe(0);
  }
  const whistle = required(buffers[1]);
  const energy = (start: number, end: number) =>
    whistle.slice(start * ctx.sampleRate, end * ctx.sampleRate).reduce((sum, n) => sum + n * n, 0);
  expect(energy(0.1, 0.6)).toBeGreaterThan(10);
  expect(energy(0.81, 0.94)).toBe(0);
  expect(energy(1.05, 1.5)).toBeGreaterThan(10);
  cars.forEach((car) => {
    car.velocity = { vx: 0, vy: -180 };
  });
  audio.updateTrains(cars, { wx: -375, wy: 0 }, true);
  expect(sources).toHaveLength(2);
  expect(sources[0]?.playbackRate.setTargetAtTime).toHaveBeenLastCalledWith(2, 10, 0.08);
  expect(gains[1]?.setTargetAtTime).toHaveBeenLastCalledWith(0.06, 10, 0.03);
  expect(pans[0]?.setTargetAtTime).toHaveBeenLastCalledWith(0.75, 10, 0.03);
  ctx.currentTime = 29;
  audio.updateTrains(cars, listener, true);
  expect(sources).toHaveLength(3);
  expect(buffers).toHaveLength(2);
});

it.each(["stopped", "range", "removed", "disabled", "suspended", "exit"])(
  "fades and disconnects rolling and whistle sources when %s",
  (reason) => {
    const { audio, ctx, sources, buffers } = audioHarness();
    audio.ensureContext();
    const car = createTrain(0, 0);
    car.velocity = { vx: 90, vy: 0 };
    const listener = { wx: 0, wy: 0 };
    audio.updateTrains([car], listener, true);
    if (reason === "stopped") car.velocity.vx = 0;
    if (reason === "range") listener.wx = 800;
    if (reason === "suspended") ctx.state = "suspended";
    if (reason === "exit") audio.stopTrains();
    else audio.updateTrains(reason === "removed" ? [] : [car], listener, reason !== "disabled");
    for (const source of sources) {
      expect(source.stop).toHaveBeenCalledWith(10.06);
      source.onended?.();
      expect(source.disconnect).toHaveBeenCalled();
    }
    expect(sources).toHaveLength(2);
    // A new departure reuses synthesis after stopping, reversing or returning to play.
    ctx.state = "running";
    car.velocity.vx = -90;
    listener.wx = 0;
    audio.updateTrains([car], listener, true);
    expect(sources).toHaveLength(4);
    expect(buffers).toHaveLength(2);
  },
);
