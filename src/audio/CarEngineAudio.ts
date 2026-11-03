import { isBoat } from "../boats/Boat.js";
import type { Entity } from "../entities/Entity.js";
import { isVehicle } from "../traffic/Vehicle.js";
import { vehiclePerformance } from "../traffic/VehiclePerformance.js";

type EngineVoice = { id: number; source: AudioBufferSourceNode; gain: GainNode };

/** One quiet local-driver engine; no ambient traffic chorus or network events. */
export class CarEngineAudio {
  private voice: EngineVoice | null = null;
  private buffer: AudioBuffer | null = null;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly output: AudioNode,
  ) {}

  update(car: Entity | undefined): void {
    if (!car || !isVehicle(car) || isBoat(car)) {
      this.stop();
      return;
    }
    if (this.voice?.id !== car.id) {
      this.stop();
      this.buffer ??= this.createBuffer();
      const source = this.ctx.createBufferSource();
      source.buffer = this.buffer;
      source.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(this.output);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
      source.start();
      this.voice = { id: car.id, source, gain };
    }
    const speed = Math.hypot(car.velocity?.vx ?? 0, car.velocity?.vy ?? 0);
    const performance = vehiclePerformance(car.type);
    const rolling = Number.isFinite(speed) ? Math.min(1, speed / (performance.speed * 1.6)) : 0;
    const base = performance.pushWeight >= 500 ? 0.7 : 0.85;
    this.voice.source.playbackRate.setTargetAtTime(base + rolling, this.ctx.currentTime, 0.12);
    this.voice.gain.gain.setTargetAtTime(0.025 + 0.035 * rolling, this.ctx.currentTime, 0.08);
  }

  stop(): void {
    const voice = this.voice;
    if (!voice) return;
    this.voice = null;
    voice.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.015);
    voice.source.stop(this.ctx.currentTime + 0.08);
  }

  /** Rounded low harmonics and gentle firing pulses, all periodic at the loop seam. */
  private createBuffer(): AudioBuffer {
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / this.ctx.sampleRate;
      const phase = 2 * Math.PI * 48 * t;
      const firing =
        0.86 + 0.1 * Math.sin(2 * Math.PI * 12 * t) + 0.04 * Math.sin(2 * Math.PI * 7 * t);
      data[i] =
        firing *
        (0.45 * Math.sin(phase) +
          0.16 * Math.sin(phase * 2) +
          0.08 * Math.sin(phase * 3) +
          // A little upper body remains audible on small phone speakers.
          0.06 * Math.sin(phase * 4) +
          0.035 * Math.sin(phase * 5));
    }
    return buffer;
  }
}
