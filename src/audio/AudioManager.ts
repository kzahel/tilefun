/**
 * Thin wrapper around the Web Audio API.
 * Handles lazy AudioContext creation, autoplay unlock, buffer preloading,
 * and one-shot playback with volume/pitch/pan.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private unlocked = false;
  private master: GainNode | null = null;

  /** Quiet game sounds while the Idea dialog owns the microphone/readback. */
  setIdeaDucking(enabled: boolean): void {
    this.ensureContext();
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(enabled ? 0.1 : 1, this.ctx.currentTime, 0.03);
  }

  /** Create or return the AudioContext. Safe to call multiple times. */
  ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  /** Resume the context if suspended (autoplay policy). Call from a user gesture. */
  tryResume(): void {
    if (this.unlocked) return;
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    if (ctx.state === "running") {
      this.unlocked = true;
    }
  }

  /** True when the AudioContext is in "running" state and ready to play. */
  get ready(): boolean {
    return this.ctx?.state === "running";
  }

  /**
   * Preload audio files by fetching and decoding them.
   * Entries with keys that are already loaded are skipped.
   */
  async preload(manifest: { key: string; path: string }[]): Promise<void> {
    const ctx = this.ensureContext();
    const pending: Promise<void>[] = [];
    for (const { key, path } of manifest) {
      if (this.buffers.has(key)) continue;
      pending.push(
        fetch(path)
          .then((res) => {
            if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
            return res.arrayBuffer();
          })
          .then((ab) => ctx.decodeAudioData(ab))
          .then((buf) => {
            this.buffers.set(key, buf);
          })
          .catch((err) => {
            console.warn(`[audio] Failed to load ${key}: ${err}`);
          }),
      );
    }
    await Promise.all(pending);
  }

  /** Get a preloaded buffer by key. */
  getBuffer(key: string): AudioBuffer | undefined {
    return this.buffers.get(key);
  }

  /** Short provisional two-pulse croak, using the existing spatial audio path. */
  playFrogCroak(volume = 0.15, pan = 0): void {
    if (this.ctx?.state !== "running") return;
    const now = this.ctx.currentTime;
    const voice = this.ctx.createOscillator();
    voice.type = "triangle";
    voice.frequency.setValueAtTime(160, now);
    voice.frequency.linearRampToValueAtTime(95, now + 0.12);
    voice.frequency.setValueAtTime(145, now + 0.17);
    voice.frequency.linearRampToValueAtTime(90, now + 0.3);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    for (const offset of [0, 0.17]) {
      gain.gain.linearRampToValueAtTime(volume, now + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.13);
    }
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan;
    voice.connect(gain);
    gain.connect(panner);
    panner.connect(this.master ?? this.ctx.destination);
    voice.onended = () => {
      voice.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
    voice.start(now);
    voice.stop(now + 0.32);
  }

  /** Provisional nasal quack, synthesized without adding or promoting art assets. */
  playDuckQuack(volume = 0.2, pan = 0): void {
    if (this.ctx?.state !== "running") return;
    const now = this.ctx.currentTime;
    const voice = this.ctx.createOscillator();
    voice.type = "sawtooth";
    voice.frequency.setValueAtTime(230, now);
    voice.frequency.exponentialRampToValueAtTime(145, now + 0.18);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 950;
    filter.Q.value = 1.5;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan;
    voice.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.master ?? this.ctx.destination);
    voice.onended = () => {
      voice.disconnect();
      filter.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
    voice.start(now);
    voice.stop(now + 0.21);
  }

  /**
   * Fire-and-forget one-shot sound playback.
   * Pipeline: AudioBufferSourceNode → GainNode → StereoPannerNode → destination
   */
  playOneShot(options: {
    buffer: AudioBuffer;
    volume?: number;
    pitch?: number;
    pan?: number;
  }): void {
    if (!this.ctx || this.ctx.state !== "running") return;

    const source = this.ctx.createBufferSource();
    source.buffer = options.buffer;
    source.playbackRate.value = options.pitch ?? 1;

    const gain = this.ctx.createGain();
    gain.gain.value = options.volume ?? 1;

    const panner = this.ctx.createStereoPanner();
    panner.pan.value = options.pan ?? 0;

    source.connect(gain);
    gain.connect(panner);
    panner.connect(this.master ?? this.ctx.destination);
    source.start();
  }
}
