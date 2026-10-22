import type { Entity, PositionComponent } from "../entities/Entity.js";
import {
  ANIMAL_RECORDINGS,
  ANIMAL_VOICES,
  type AnimalVoice,
  animalAudioPose,
  animalVoiceForType,
} from "./AnimalVoice.js";

interface AnimalSoundState {
  type: string;
  pose: string;
  next: number;
  cooldown: number;
  variant: number;
  request: number;
  heldBall: number | undefined;
}
/** Recorded voices are presentation of replicated poses, plus sparse local idle ambience. */
export class AnimalAudio {
  private states = new Map<number, AnimalSoundState>();
  private actors = new Map<number, Entity>();
  private balls = new Map<number, Entity>();
  private carriers = new Set<number>();
  private voices = new Map<number, AudioBufferSourceNode>();
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | undefined>>();
  private listener: PositionComponent = { wx: 0, wy: 0 };
  private enabled = false;
  private epoch = 0;
  private nextAmbient = 0;
  private nextCricket = 0;
  private insects = new Set<number>();
  private auditionSerial = 0;
  private played = 0;
  private auditionVariant = new Map<AnimalVoice, number>();

  constructor(
    private ctx: AudioContext,
    private destination: AudioNode,
    private slots: () => number,
  ) {}

  get diagnostics(): { active: number; played: number } {
    return { active: this.voices.size, played: this.played };
  }

  update(entities: readonly Entity[], listener: PositionComponent, enabled: boolean): void {
    this.listener = listener;
    this.enabled = enabled && this.ctx.state === "running";
    if (!this.enabled) this.stop();
    const now = this.ctx.currentTime;
    this.actors.clear();
    this.balls.clear();
    this.carriers.clear();
    const heldBalls = new Map<number, number>(),
      players: Entity[] = [];
    for (const entity of entities) {
      if (entity.parentId !== undefined) this.carriers.add(entity.parentId);
      if (entity.type === "ball") {
        this.balls.set(entity.id, entity);
        if (entity.parentId !== undefined) heldBalls.set(entity.parentId, entity.id);
      }
      if (entity.type === "player") players.push(entity);
    }
    const candidates: {
      actor: Entity;
      state: AnimalSoundState;
      voice: AnimalVoice;
      action: boolean;
      distance: number;
      ball: number | undefined;
    }[] = [];
    for (const actor of entities) {
      const voice = animalVoiceForType(actor.type);
      if (!voice || actor.deathTimer !== undefined || actor.parentId !== undefined) continue;
      const profile = ANIMAL_VOICES[voice];
      this.actors.set(actor.id, actor);
      const pose = animalAudioPose(actor),
        distance = Math.hypot(actor.position.wx - listener.wx, actor.position.wy - listener.wy);
      let state = this.states.get(actor.id);
      const previous = state?.type === actor.type ? state.pose : undefined;
      if (!state || state.type !== actor.type) {
        state = {
          type: actor.type,
          pose,
          next: profile.flightBuzz ? now : now + 8 + (((actor.id * 7) >>> 0) % 13),
          cooldown: 0,
          variant: actor.id >>> 0,
          request: 0,
          heldBall: undefined,
        };
        this.states.set(actor.id, state);
      }
      state.pose = pose;
      const releasedBall =
        state.heldBall === undefined ? undefined : this.balls.get(state.heldBall);
      state.heldBall = heldBalls.get(actor.id);
      // Older dog coats have no release clip. Observe the actual replicated drop
      // beside a player; deletion, transfer, alarm or a distant drop is not a return.
      const returnedBall =
        voice === "dog" &&
        releasedBall &&
        state.heldBall === undefined &&
        releasedBall.parentId === undefined &&
        releasedBall.deathTimer === undefined &&
        actor.wanderAI?.state !== "scared" &&
        Math.hypot(
          releasedBall.position.wx - actor.position.wx,
          releasedBall.position.wy - actor.position.wy,
        ) <= 40 &&
        players.some(
          (p) =>
            Math.hypot(p.position.wx - actor.position.wx, p.position.wy - actor.position.wy) <=
              48 && Math.abs((p.wz ?? 0) - (actor.wz ?? 0)) <= 6,
        );
      if (
        !this.enabled ||
        distance >= 300 ||
        (profile.quietWhileCarrying && this.carriers.has(actor.id)) ||
        (profile.insect && !this.ambientEligible(actor, voice))
      ) {
        state.next = profile.flightBuzz ? now : now + 8 + (((actor.id * 7) >>> 0) % 13);
        this.voices.get(actor.id)?.stop();
        this.voices.delete(actor.id);
        this.insects.delete(actor.id);
        state.request++;
        continue;
      }
      const action =
          !!returnedBall ||
          (previous !== undefined &&
            previous !== pose &&
            (profile.cues.includes(pose) || profile.alarmCue === pose) &&
            (actor.sprite?.clipElapsedMs ?? 0) <= 180),
        idle = this.ambientEligible(actor, voice);
      if (
        now >= state.cooldown &&
        (action || (idle && now >= state.next && now >= this.nextAmbient))
      )
        candidates.push({
          actor,
          state,
          voice,
          action,
          distance,
          ball: returnedBall ? releasedBall.id : undefined,
        });
    }
    // Action cues win; the nearest eligible actor wins over array/spawn order.
    candidates.sort(
      (a, b) =>
        Number(b.action) - Number(a.action) || a.distance - b.distance || a.actor.id - b.actor.id,
    );
    for (const candidate of candidates) {
      const { actor, state, voice, action } = candidate;
      if (!action && now < this.nextAmbient) continue;
      if (ANIMAL_VOICES[voice].insect && this.insects.size) continue;
      if (voice === "cricket" && now < this.nextCricket) continue;
      if (this.voices.size >= this.slots()) break;
      state.cooldown = now + ANIMAL_VOICES[voice].cooldown;
      state.next = ANIMAL_VOICES[voice].flightBuzz
        ? now + 4 + (((actor.id + state.variant) >>> 0) % 4)
        : now + 24 + (((actor.id + state.variant * 11) >>> 0) % 19);
      if (!action) this.nextAmbient = now + 3;
      if (voice === "cricket") this.nextCricket = now + 12;
      void this.requestVoice(actor, state, voice, action, candidate.ball);
    }
    for (const id of this.states.keys()) if (!this.actors.has(id)) this.states.delete(id);
    for (const [id, source] of this.voices)
      if (!this.actors.has(id)) {
        source.stop();
        this.voices.delete(id);
        this.insects.delete(id);
      }
  }

  private ambientEligible(actor: Entity, voice: AnimalVoice): boolean {
    const profile = ANIMAL_VOICES[voice];
    if (profile.ambient === false || actor.wanderAI?.state === "scared") return false;
    return profile.flightBuzz
      ? animalAudioPose(actor) === "fly" && !!actor.sprite?.moving
      : animalAudioPose(actor) === "idle" && !actor.sprite?.moving;
  }

  private async load(path: string): Promise<AudioBuffer | undefined> {
    const cached = this.buffers.get(path);
    if (cached) return cached;
    let pending = this.loading.get(path);
    if (!pending) {
      pending = fetch(`${import.meta.env.BASE_URL}${path}`)
        .then((response) => {
          if (!response.ok) throw new Error(`Animal audio HTTP ${response.status}`);
          return response.arrayBuffer();
        })
        .then((bytes) => this.ctx.decodeAudioData(bytes))
        .then((buffer) => {
          this.buffers.set(path, buffer);
          return buffer;
        })
        .catch((error: unknown) => {
          console.warn("[audio] Animal voice unavailable", path, error);
          return undefined;
        })
        .finally(() => this.loading.delete(path));
      this.loading.set(path, pending);
    }
    return pending;
  }

  private async requestVoice(
    actor: Entity,
    state: AnimalSoundState,
    voice: AnimalVoice,
    action: boolean,
    ballId?: number,
  ): Promise<void> {
    const paths = ANIMAL_RECORDINGS[voice],
      path = paths[state.variant++ % paths.length];
    if (!path) return;
    const epoch = this.epoch,
      request = ++state.request,
      requestedAt = this.ctx.currentTime,
      pose = animalAudioPose(actor);
    const buffer = await this.load(path),
      current = this.actors.get(actor.id),
      ball = ballId === undefined ? undefined : this.balls.get(ballId);
    if (
      !buffer ||
      !this.enabled ||
      epoch !== this.epoch ||
      this.states.get(actor.id) !== state ||
      state.request !== request ||
      !current ||
      (ANIMAL_VOICES[voice].quietWhileCarrying && this.carriers.has(actor.id)) ||
      (current.wanderAI?.state === "scared" && ANIMAL_VOICES[voice].alarmCue !== pose) ||
      this.ctx.currentTime - requestedAt > 0.6 ||
      (ballId !== undefined
        ? !ball ||
          ball.parentId !== undefined ||
          ball.deathTimer !== undefined ||
          Math.hypot(
            ball.position.wx - current.position.wx,
            ball.position.wy - current.position.wy,
          ) > 40
        : action
          ? animalAudioPose(current) !== pose
          : !this.ambientEligible(current, voice)) ||
      (ANIMAL_VOICES[voice].insect && this.insects.size > 0)
    )
      return;
    const distance = Math.hypot(
      current.position.wx - this.listener.wx,
      current.position.wy - this.listener.wy,
    );
    if (distance >= 300) return;
    this.play(
      actor.id,
      buffer,
      (action ? 0.32 : 0.22) * (1 - distance / 300) ** 2,
      Math.max(-0.8, Math.min(0.8, (current.position.wx - this.listener.wx) / 240)),
      ANIMAL_VOICES[voice].insect,
    );
  }

  private play(
    id: number,
    buffer: AudioBuffer,
    volume: number,
    pan: number,
    insect = false,
  ): boolean {
    if (this.ctx.state !== "running" || this.voices.size >= this.slots()) return false;
    this.voices.get(id)?.stop();
    this.insects.delete(id);
    const source = this.ctx.createBufferSource(),
      gain = this.ctx.createGain(),
      panner = this.ctx.createStereoPanner();
    source.buffer = buffer;
    gain.gain.value = volume;
    panner.pan.value = pan;
    source.connect(gain);
    gain.connect(panner);
    panner.connect(this.destination);
    source.onended = () => {
      if (this.voices.get(id) === source) {
        this.voices.delete(id);
        this.insects.delete(id);
      }
      source.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
    this.voices.set(id, source);
    if (insect) this.insects.add(id);
    source.start();
    this.played++;
    return true;
  }

  /** Explicit user gesture; supersedes earlier pending auditions and cycles real takes. */
  async audition(voice: AnimalVoice): Promise<boolean> {
    const serial = ++this.auditionSerial,
      epoch = this.epoch,
      paths = ANIMAL_RECORDINGS[voice],
      index = this.auditionVariant.get(voice) ?? 0,
      path = paths[index % paths.length];
    if (!path) return false;
    this.auditionVariant.set(voice, index + 1);
    this.voices.get(-1)?.stop();
    const buffer = await this.load(path);
    if (!buffer || serial !== this.auditionSerial || epoch !== this.epoch) return false;
    return this.play(-1, buffer, 0.35, 0);
  }

  cancelAudition(): void {
    this.auditionSerial++;
    this.voices.get(-1)?.stop();
    this.voices.delete(-1);
  }

  stop(): void {
    this.enabled = false;
    this.epoch++;
    this.auditionSerial++;
    // Scene/menu boundaries can reuse numeric entity IDs. Forget observations so
    // a restored loose toy cannot look like a new drop from the previous scene.
    this.states.clear();
    this.actors.clear();
    this.balls.clear();
    this.carriers.clear();
    for (const source of this.voices.values()) source.stop();
    this.voices.clear();
    this.insects.clear();
  }
}
