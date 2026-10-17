import type { Entity, PositionComponent } from "../entities/Entity.js";
import { CURVE_TRAIN } from "../railway/CurveTrain.js";
import { TRAIN_TYPE } from "../railway/Train.js";

const RANGE = 750;
const WHISTLE_INTERVAL = 18;

type Voice = { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode };
type TrainVoice = { rolling: Voice; whistle: Voice | null; nextWhistle: number };

/** Browser-only train sound; replicated velocity owns cadence, never rail simulation. */
export class TrainAudio {
  private voices = new Map<number, TrainVoice>();
  private rollingBuffer: AudioBuffer | null = null;
  private whistleBuffer: AudioBuffer | null = null;

  constructor(
    private ctx: BaseAudioContext,
    private output: AudioNode,
  ) {}

  update(entities: readonly Entity[], listener: PositionComponent): void {
    const live = new Set<number>();
    for (const entity of entities) {
      // One middle carriage per consist, including legacy single-body trains.
      if (
        entity.type !== CURVE_TRAIN &&
        entity.type !== TRAIN_TYPE &&
        entity.type !== "train-carriage-v1:middle"
      )
        continue;
      const speed = Math.hypot(entity.velocity?.vx ?? 0, entity.velocity?.vy ?? 0);
      const dx = entity.position.wx - listener.wx;
      const distance = Math.hypot(dx, entity.position.wy - listener.wy);
      if (speed < 2 || distance >= RANGE) continue;
      live.add(entity.id);
      let voice = this.voices.get(entity.id);
      if (!voice) {
        this.rollingBuffer ??= this.buffer("rolling");
        voice = {
          rolling: this.start(this.rollingBuffer, true),
          whistle: null,
          nextWhistle: 0,
        };
        this.voices.set(entity.id, voice);
      }
      const volume = (1 - distance / RANGE) ** 2;
      const pan = Math.max(-0.8, Math.min(0.8, dx / 500));
      voice.rolling.source.playbackRate.setTargetAtTime(
        Math.max(0.35, Math.min(2.5, speed / 90)),
        this.ctx.currentTime,
        0.08,
      );
      this.spatial(voice.rolling, volume * 0.24, pan);
      if (this.ctx.currentTime >= voice.nextWhistle) {
        this.whistleBuffer ??= this.buffer("whistle");
        voice.whistle = this.start(this.whistleBuffer, false);
        voice.nextWhistle = this.ctx.currentTime + WHISTLE_INTERVAL;
      }
      if (voice.whistle) this.spatial(voice.whistle, volume * 0.18, pan);
    }
    for (const [id, voice] of this.voices) {
      if (live.has(id)) continue;
      this.stopVoice(voice.rolling);
      if (voice.whistle) this.stopVoice(voice.whistle);
      this.voices.delete(id);
    }
  }

  stop(): void {
    for (const voice of this.voices.values()) {
      this.stopVoice(voice.rolling);
      if (voice.whistle) this.stopVoice(voice.whistle);
    }
    this.voices.clear();
  }

  private spatial(voice: Voice, volume: number, pan: number): void {
    voice.gain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.03);
    voice.pan.pan.setTargetAtTime(pan, this.ctx.currentTime, 0.03);
  }

  private start(buffer: AudioBuffer, loop: boolean): Voice {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    const pan = this.ctx.createStereoPanner();
    source.connect(gain);
    gain.connect(pan);
    pan.connect(this.output);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      pan.disconnect();
    };
    source.start();
    return { source, gain, pan };
  }

  private stopVoice(voice: Voice): void {
    voice.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
    voice.source.stop(this.ctx.currentTime + 0.06);
  }

  /** Original, deterministic synthesis: airy chuffs, paired rail taps, warm whistle. */
  private buffer(kind: "rolling" | "whistle"): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, Math.round(rate * (kind === "rolling" ? 1 : 2)), rate);
    const data = buffer.getChannelData(0);
    let seed = 17;
    let air = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / rate;
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      const noise = seed / 2147483648;
      air += 0.18 * (noise - air);
      if (kind === "rolling") {
        const beat = t % 0.25;
        const chuff = Math.sin((Math.PI * Math.min(beat, 0.16)) / 0.16) ** 2;
        const tap = (t + 0.01) % 0.5;
        const clack = Math.exp(-tap * 100) + 0.7 * Math.exp(-((tap + 0.4) % 0.5) * 100);
        data[i] =
          0.65 * air * chuff + 0.12 * Math.sin(2 * Math.PI * 65 * t) * chuff + 0.25 * noise * clack;
      } else {
        // Two rounded "woooo" calls with a little breath and a falling tail.
        const pulse = t < 0.8 ? t : t - 0.95;
        const envelope =
          pulse >= 0 && pulse < 0.8 ? Math.min(1, pulse / 0.09, (0.8 - pulse) / 0.2) : 0;
        const phase = 2 * Math.PI * (440 * t - 12 * t * t + 0.6 * Math.sin(9 * t));
        data[i] =
          envelope *
          (0.42 * Math.sin(phase) +
            0.2 * Math.sin(phase * 1.25) +
            0.16 * Math.sin(phase * 1.5) +
            0.08 * air);
      }
      // Smooth loop seam and one-shot edges.
      data[i] = (data[i] ?? 0) * Math.min(1, t / 0.008, (data.length - 1 - i) / rate / 0.008);
    }
    return buffer;
  }
}
