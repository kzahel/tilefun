/**
 * Thin wrapper around the Web Audio API.
 * Handles lazy AudioContext creation, autoplay unlock, buffer preloading,
 * and one-shot playback with volume/pitch/pan.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private unlocked = false;

  /** Create or return the AudioContext. Safe to call multiple times. */
  ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
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
    panner.connect(this.ctx.destination);
    source.start();
  }
}
