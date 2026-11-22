import * as THREE from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { SpriteItem } from "../SceneItem.js";
import type { WildlifeMeshDefinition } from "../WildlifeMeshCatalog.js";

interface Instance {
  readonly pivot: THREE.Group;
  readonly mixer: THREE.AnimationMixer;
  readonly skeletons: Set<THREE.Skeleton>;
}

interface ClipSample {
  readonly clip: THREE.AnimationClip;
  readonly start: number;
  readonly count: number;
  readonly frameDuration: number;
  readonly loop: boolean;
}

const HEADING = [0, Math.PI, Math.PI / 2, -Math.PI / 2] as const;

/** Pose the same source GLB independently for each visible animal. Copies share
 * mesh buffers and paint, and only the skeleton and animation player vary. */
export class SkinnedWildlifeBatch {
  private readonly group = new THREE.Group();
  private readonly instances: Instance[] = [];
  private readonly samples: ClipSample[];
  private count = 0;

  constructor(
    root: THREE.Group,
    private readonly source: THREE.Group,
    animations: readonly THREE.AnimationClip[],
    private readonly definition: WildlifeMeshDefinition,
    private readonly scale: number,
    /** Marks each copy's meshes as casters of dynamic shadows (266). */
    private readonly cast: (mesh: THREE.Object3D) => void = () => {},
  ) {
    const bank = new Map(animations.map((animation) => [animation.name, animation]));
    this.samples = (definition.animation?.clips ?? []).map(
      ({ name, start, count, frameDuration, loop }) => {
        const clip = bank.get(definition.animation?.names?.[name] ?? name);
        if (!clip || !(clip.duration > 0)) throw new Error(`Missing wildlife animation: ${name}`);
        return { clip, start, count, frameDuration, loop };
      },
    );
    if (!this.samples.length) throw new Error("Missing wildlife animation mapping");
    root.add(this.group);
  }

  begin(): void {
    this.count = 0;
  }

  push(item: SpriteItem, topDown: boolean): void {
    const instance = this.instances[this.count] ?? this.createInstance();
    this.count++;
    const fit = topDown ? this.definition.topDown : undefined;
    instance.pivot.scale.set(
      this.scale * (fit?.width ?? 1),
      this.scale,
      this.scale * (fit?.height ?? 1),
    );
    instance.pivot.position.set(item.wx, item.wy, item.zOffset);
    instance.pivot.rotation.z =
      HEADING[item.wildlifePose?.direction ?? item.facing ?? item.frameRow] ?? 0;
    instance.pivot.visible = true;

    const indexed = this.samples[item.wildlifePose?.clip ?? -1];
    const chosen =
      indexed ??
      this.samples.find(
        ({ start, count }) => item.frameCol >= start && item.frameCol < start + count,
      ) ??
      this.samples[0];
    if (!chosen) return;
    const duration = chosen.clip.duration;
    const frame = Math.max(0, item.frameCol - chosen.start);
    const elapsed = item.wildlifePose?.elapsedMs;
    const spriteDuration = chosen.frameDuration * chosen.count;
    const framePhase =
      (frame + (item.wildlifePose?.frameTimeMs ?? 0) / chosen.frameDuration) / chosen.count;
    const phase =
      chosen.count === 1 && chosen.loop
        ? ((item.wildlifePose?.idleTime ?? 0) % duration) / duration
        : elapsed !== undefined
          ? chosen.loop
            ? (elapsed % spriteDuration) / spriteDuration
            : Math.min(1, elapsed / spriteDuration)
          : !chosen.loop && frame >= chosen.count - 1
            ? 1
            : Math.min(1, framePhase);
    const mixer = instance.mixer;
    mixer.stopAllAction();
    const action = mixer.clipAction(chosen.clip).reset();
    action.setLoop(THREE.LoopOnce, 1).play();
    action.clampWhenFinished = true;
    mixer.setTime(phase * duration);
  }

  end(): void {
    for (let i = this.count; i < this.instances.length; i++) {
      const instance = this.instances[i];
      if (instance) instance.pivot.visible = false;
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const { mixer, skeletons } of this.instances) {
      mixer.stopAllAction();
      mixer.uncacheRoot(mixer.getRoot());
      for (const skeleton of skeletons) skeleton.dispose();
    }
    this.instances.length = 0;
  }

  private createInstance(): Instance {
    const model = clone(this.source);
    const pivot = new THREE.Group();
    const carrier = new THREE.Group();
    carrier.rotation.x = Math.PI / 2;
    carrier.add(model);
    pivot.add(carrier);
    this.group.add(pivot);
    const skeletons = new Set<THREE.Skeleton>();
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) this.cast(object);
      if (object instanceof THREE.SkinnedMesh) {
        object.frustumCulled = false;
        skeletons.add(object.skeleton);
      }
    });
    const result = { pivot, mixer: new THREE.AnimationMixer(model), skeletons };
    this.instances.push(result);
    return result;
  }
}
