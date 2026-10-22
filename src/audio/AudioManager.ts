import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { VehicleHornMessage } from "../shared/protocol.js";
import { emergencyEnabled, isEmergencyVehicle, sirenStyle } from "../traffic/EmergencyVehicle.js";
import { predatorProfile } from "../wildlife/Predator.js";
import { AnimalAudio } from "./AnimalAudio.js";
import { animalVoiceForSpecies } from "./AnimalVoice.js";
import { creatureCallSamples } from "./CreatureCall.js";
import { TrainAudio } from "./TrainAudio.js";

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
  private trains: TrainAudio | null = null;
  private creatureClips = new Map<number, number | undefined>();
  private creatureVoices = new Map<number, AudioBufferSourceNode>();
  private creatureBuffers = new Map<string, AudioBuffer>();
  private creatureCallsPlayed = 0;
  private animals: AnimalAudio | null = null;
  private horns = new Map<
    number,
    {
      voices: OscillatorNode[];
      gain: GainNode;
      pan: StereoPannerNode;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  /** Calls follow replicated display clips, so all hosts hear the same authority cue. */
  updateCreatureCalls(
    entities: readonly Entity[],
    listener: PositionComponent,
    enabled: boolean,
  ): void {
    if (!enabled) this.stopCreatureCalls();
    if (this.ctx) this.recordedAnimals().update(entities, listener, enabled);
    const live = new Set<number>();
    for (const entity of entities) {
      const profile = predatorProfile(entity.type),
        kind = profile?.callKind ?? profile?.fierce?.kind;
      if (!kind) continue;
      live.add(entity.id);
      const previous = this.creatureClips.get(entity.id),
        clip = entity.sprite?.clip;
      this.creatureClips.set(entity.id, clip);
      const distance = Math.hypot(
        entity.position.wx - listener.wx,
        entity.position.wy - listener.wy,
      );
      // Late joins/reloads in the middle of a display do not replay its onset.
      if (
        !enabled ||
        previous === 3 ||
        clip !== 3 ||
        (entity.sprite?.clipElapsedMs ?? 0) > 180 ||
        distance >= 480
      )
        continue;
      this.playCreatureCall(
        entity.id,
        kind,
        0.15 * (1 - distance / 480) ** 2,
        Math.max(-0.8, Math.min(0.8, (entity.position.wx - listener.wx) / 320)),
      );
    }
    for (const id of this.creatureClips.keys()) if (!live.has(id)) this.creatureClips.delete(id);
    for (const [id, source] of this.creatureVoices)
      if (!live.has(id)) {
        source.stop();
        this.creatureVoices.delete(id);
      }
  }

  playCreatureCall(
    id: number,
    kind: Parameters<typeof creatureCallSamples>[0],
    volume: number,
    pan: number,
  ): void {
    const ctx = this.ctx;
    if (ctx?.state !== "running" || this.creatureAudioDiagnostics.active >= 6) return;
    let buffer = this.creatureBuffers.get(kind);
    if (!buffer) {
      const samples = creatureCallSamples(kind, ctx.sampleRate);
      buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buffer.getChannelData(0).set(samples);
      this.creatureBuffers.set(kind, buffer);
    }
    this.creatureVoices.get(id)?.stop();
    const source = ctx.createBufferSource(),
      gain = ctx.createGain(),
      panner = ctx.createStereoPanner();
    source.buffer = buffer;
    gain.gain.value = volume;
    panner.pan.value = pan;
    source.connect(gain);
    gain.connect(panner);
    panner.connect(this.master ?? ctx.destination);
    source.onended = () => {
      if (this.creatureVoices.get(id) === source) this.creatureVoices.delete(id);
      source.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
    this.creatureVoices.set(id, source);
    this.creatureCallsPlayed++;
    source.start();
  }

  stopCreatureCalls(): void {
    this.animals?.stop();
    for (const source of this.creatureVoices.values()) source.stop();
    this.creatureVoices.clear();
  }

  get creatureAudioDiagnostics(): { active: number; played: number } {
    return {
      active: this.creatureVoices.size + (this.animals?.diagnostics.active ?? 0),
      played: this.creatureCallsPlayed + (this.animals?.diagnostics.played ?? 0),
    };
  }

  private recordedAnimals(): AnimalAudio {
    this.animals ??= new AnimalAudio(
      this.ensureContext(),
      this.master ?? this.ensureContext().destination,
      () => 6 - this.creatureVoices.size,
    );
    return this.animals;
  }

  /** Call directly from a button gesture to preserve browser audio unlock. */
  async auditionAnimalVoice(species: string): Promise<boolean> {
    const voice = animalVoiceForSpecies(species);
    if (!voice) return false;
    this.tryResume();
    return this.recordedAnimals().audition(voice);
  }

  /** Release a lab-owned manager; main-game scenes only stop their borrowed voices. */
  dispose(): void {
    this.stopCreatureCalls();
    this.stopHorns();
    this.stopSirens();
    this.stopTrains();
    this.creatureClips.clear();
    if (this.ctx) void this.ctx.close();
    this.animals = null;
    this.ctx = null;
  }

  updateTrains(entities: readonly Entity[], listener: PositionComponent, enabled: boolean): void {
    if (!enabled || !this.ctx || this.ctx.state !== "running") {
      this.stopTrains();
      return;
    }
    this.trains ??= new TrainAudio(this.ctx, this.master ?? this.ctx.destination);
    this.trains.update(entities, listener);
  }

  stopTrains(): void {
    this.trains?.stop();
  }

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

  /** Refresh one continuous voice per vehicle; a lost connection cannot leave it sounding. */
  playVehicleHorn(horn: VehicleHornMessage, listener: PositionComponent): void {
    const ctx = this.ctx;
    const distance = Math.hypot(horn.wx - listener.wx, horn.wy - listener.wy);
    if (!horn.active || distance >= 750 || ctx?.state !== "running") {
      this.stopHorn(horn.vehicleId);
      return;
    }
    let sound = this.horns.get(horn.vehicleId);
    if (!sound) {
      const frequencies =
        horn.kind === "train" ? [440, 554, 660] : horn.kind === "heavy" ? [155, 196] : [350, 440];
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const pan = ctx.createStereoPanner();
      gain.connect(pan);
      pan.connect(this.master ?? ctx.destination);
      const voices = frequencies.map((frequency) => {
        const voice = ctx.createOscillator();
        voice.type = horn.kind === "train" ? "sine" : "triangle";
        voice.frequency.value = frequency;
        voice.connect(gain);
        voice.start();
        return voice;
      });
      sound = { voices, gain, pan, timeout: setTimeout(() => this.stopHorn(horn.vehicleId), 700) };
      this.horns.set(horn.vehicleId, sound);
    } else {
      clearTimeout(sound.timeout);
      sound.timeout = setTimeout(() => this.stopHorn(horn.vehicleId), 700);
    }
    sound.gain.gain.setTargetAtTime(0.09 * (1 - distance / 750) ** 2, ctx.currentTime, 0.01);
    sound.pan.pan.value = Math.max(-0.8, Math.min(0.8, (horn.wx - listener.wx) / 500));
  }

  private stopHorn(id: number): void {
    const sound = this.horns.get(id);
    if (!sound || !this.ctx) return;
    this.horns.delete(id);
    clearTimeout(sound.timeout);
    sound.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
    let remaining = sound.voices.length;
    for (const voice of sound.voices) {
      voice.onended = () => {
        voice.disconnect();
        if (--remaining === 0) {
          sound.gain.disconnect();
          sound.pan.disconnect();
        }
      };
      voice.stop(this.ctx.currentTime + 0.06);
    }
  }

  stopHorns(): void {
    for (const id of this.horns.keys()) this.stopHorn(id);
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
