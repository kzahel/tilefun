import type { Entity, PositionComponent } from "../entities/Entity.js";
import { emergencyEnabled, isEmergencyVehicle, sirenStyle } from "../traffic/EmergencyVehicle.js";

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
  private sirens = new Map<
    number,
    { style: number; source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode }
  >();
  private sirenBuffers = new Map<number, AudioBuffer>();

  updateSirens(entities: readonly Entity[], listener: PositionComponent, enabled: boolean): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || !enabled) {
      this.stopSirens();
      return;
    }
    const audible = new Set<number>();
    for (const entity of entities) {
      if (!isEmergencyVehicle(entity)) continue;
      const style = sirenStyle(entity.emergencyState);
      const distance = Math.hypot(
        entity.position.wx - listener.wx,
        entity.position.wy - listener.wy,
      );
      if (!emergencyEnabled(entity.emergencyState) || !style || distance >= 600) continue;
      audible.add(entity.id);
      let voice = this.sirens.get(entity.id);
      if (voice && voice.style !== style) {
        this.stopSiren(entity.id);
        voice = undefined;
      }
      if (!voice) {
        let buffer = this.sirenBuffers.get(style);
        if (!buffer) {
          buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          let phase = 0;
          for (let i = 0; i < data.length; i++) {
            const time = i / ctx.sampleRate;
            const pitch =
              style === 1
                ? 500 + 80 * Math.tanh(12 * Math.sin(2 * Math.PI * time))
                : 720 - 280 * Math.cos(Math.PI * time);
            phase = (phase + pitch / ctx.sampleRate) % 1;
            data[i] = 1 - 4 * Math.abs(phase - 0.5);
          }
          // Quiet seam avoids clicks when the loop wraps.
          for (let i = 0; i < ctx.sampleRate * 0.01; i++) {
            const fade = i / (ctx.sampleRate * 0.01);
            data[i] = (data[i] ?? 0) * fade;
            const end = data.length - i - 1;
            data[end] = (data[end] ?? 0) * fade;
          }
          this.sirenBuffers.set(style, buffer);
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        const pan = ctx.createStereoPanner();
        source.connect(gain);
        gain.connect(pan);
        pan.connect(this.master ?? ctx.destination);
        source.start();
        voice = { style, source, gain, pan };
        this.sirens.set(entity.id, voice);
      }
      voice.gain.gain.setTargetAtTime(0.12 * (1 - distance / 600) ** 2, ctx.currentTime, 0.03);
      voice.pan.pan.setTargetAtTime(
        Math.max(-1, Math.min(1, (entity.position.wx - listener.wx) / 400)),
        ctx.currentTime,
        0.03,
      );
    }
    for (const id of this.sirens.keys()) if (!audible.has(id)) this.stopSiren(id);
  }
  private stopSiren(id: number): void {
    const voice = this.sirens.get(id);
    if (!voice || !this.ctx) return;
    this.sirens.delete(id);
    voice.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
    voice.source.onended = () => {
      voice.source.disconnect();
      voice.gain.disconnect();
      voice.pan.disconnect();
    };
    voice.source.stop(this.ctx.currentTime + 0.06);
  }
  stopSirens(): void {
    for (const id of this.sirens.keys()) this.stopSiren(id);
  }

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

  /** Short provisional three-note robin call, using the existing spatial audio path. */
  playRobinChirp(volume = 0.1, pan = 0): void {
    if (this.ctx?.state !== "running") return;
    const now = this.ctx.currentTime;
    const voice = this.ctx.createOscillator();
    voice.type = "sine";
    for (const [offset, pitch] of [
      [0, 2200],
      [0.12, 2900],
      [0.24, 2500],
    ]) {
      voice.frequency.setValueAtTime(pitch ?? 2200, now + (offset ?? 0));
      voice.frequency.exponentialRampToValueAtTime(1800, now + (offset ?? 0) + 0.09);
    }
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    for (const offset of [0, 0.12, 0.24]) {
      gain.gain.linearRampToValueAtTime(volume, now + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);
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
    voice.stop(now + 0.36);
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
