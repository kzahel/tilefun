import { afterEach, expect, it, vi } from "vitest";
import { createVehicle } from "../traffic/Vehicle.js";
import { AudioManager } from "./AudioManager.js";

afterEach(() => vi.unstubAllGlobals());
it("keeps one spatial looping voice, changes style, and stops for quiet/off/range/pause", () => {
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
  const car = createVehicle("ambulance", 0, 0);
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
});
