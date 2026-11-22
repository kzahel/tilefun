import { type SkyClockView, skyAt, strikesBetween } from "../sky/Sky.js";

/** Rain's loudest, and how much of it and of thunder a roof lets through. */
const RAIN_VOLUME = 0.11;
const THUNDER_VOLUME = 0.34;
const INDOOR_RAIN = 0.35;
const INDOOR_THUNDER = 0.5;
/** Thunder follows its flash by this long at least, and this much more when far. */
const THUNDER_DELAY = 0.25;
const THUNDER_FAR_DELAY = 2.2;

/**
 * Rain and thunder, made from noise: there are no recordings to load. Rain is one
 * looping voice whose loudness follows the sky; each lightning strike on the
 * world's clock rumbles once, later and quieter the farther it is.
 */
export class WeatherAudio {
  private rain: { source: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null =
    null;
  private noise: AudioBuffer | null = null;
  private rumble: AudioBuffer | null = null;
  /** The clock time thunder has been scheduled up to. */
  private heard: number | undefined;

  constructor(
    private readonly ctx: BaseAudioContext,
    readonly output: AudioNode,
  ) {}

  /** `clock` is the world's, or undefined where there is no sky to hear. */
  update(clock: SkyClockView | undefined, indoors: boolean): void {
    if (!clock) {
      this.stop();
      return;
    }
    const sky = skyAt(clock.seed, clock.time, clock.held);
    this.setRain(sky.rain * (indoors ? INDOOR_RAIN : 1), indoors);
    const from = this.heard ?? clock.time;
    this.heard = clock.time;
    for (const strike of strikesBetween(clock.seed, from, clock.time, clock.held))
      this.thunder(strike.distance, indoors);
  }

  stop(): void {
    this.heard = undefined;
    if (!this.rain) return;
    this.rain.source.stop();
    this.rain.gain.disconnect();
    this.rain = null;
  }

  private setRain(level: number, indoors: boolean): void {
    if (level <= 0.001 && !this.rain) return;
    if (!this.rain) {
      this.noise ??= noiseBuffer(this.ctx, 2, false);
      const source = this.ctx.createBufferSource();
      source.buffer = this.noise;
      source.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 0.4;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(this.output);
      source.start();
      this.rain = { source, filter, gain };
    }
    const now = this.ctx.currentTime;
    // A roof takes the hiss off the top.
    this.rain.filter.frequency.setTargetAtTime(indoors ? 700 : 2600, now, 0.3);
    this.rain.gain.gain.setTargetAtTime(level * RAIN_VOLUME, now, 0.4);
  }

  private thunder(distance: number, indoors: boolean): void {
    this.rumble ??= noiseBuffer(this.ctx, 4, true);
    const start = this.ctx.currentTime + THUNDER_DELAY + distance * THUNDER_FAR_DELAY;
    const length = 2.2 + distance * 1.4;
    const source = this.ctx.createBufferSource();
    source.buffer = this.rumble;
    source.playbackRate.value = 0.7 + Math.random() * 0.4;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    // Near thunder cracks before it rolls; far thunder only rolls.
    filter.frequency.setValueAtTime(900 - 600 * distance, start);
    filter.frequency.exponentialRampToValueAtTime(110, start + 0.6);
    const gain = this.ctx.createGain();
    const peak = THUNDER_VOLUME * (1 - 0.6 * distance) * (indoors ? INDOOR_THUNDER : 1);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + length);
    source.connect(filter).connect(gain).connect(this.output);
    source.start(start);
    source.stop(start + length + 0.1);
    source.onended = () => gain.disconnect();
  }
}

/** White noise, or (`rolling`) noise summed over time for a low rumble. */
function noiseBuffer(ctx: BaseAudioContext, seconds: number, rolling: boolean): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < samples.length; i++) {
    const white = Math.random() * 2 - 1;
    last = rolling ? (last + 0.02 * white) / 1.02 : white;
    samples[i] = rolling ? last * 3.5 : white;
  }
  return buffer;
}
