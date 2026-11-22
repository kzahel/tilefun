/// <reference types="vite/client" />

import type { Euler } from "three";
import { type AnimationClip, ENTITY_DEFS } from "../entities/EntityDefs.js";
import { FAUNA_DEFS, faunaType } from "../wildlife/Fauna.js";
import { RABBIT_CLIPS, RABBIT_TYPE } from "../wildlife/Rabbit.js";
import {
  WILDLIFE_MODEL_REVIEWS,
  wildlifeModelClips,
  wildlifeModelReviewPath,
} from "../wildlife/WildlifeModelReviewBank.js";

export interface WildlifeMeshDefinition {
  /** Self-contained GLB with feet on local ground and forward along glTF −Z. */
  readonly path: string;
  readonly height: number;
  /** Authored fit maps Blender units directly to game pixels. */
  readonly unitScale?: number;
  /** Asset-local width and height registration for the oblique gameplay view. */
  readonly topDown?: { readonly width: number; readonly height: number };
  /** Local rotation relative to the part's GLB pose, driven by the existing sprite frame. */
  readonly pose?: (part: string, frame: number, rotation: Euler) => void;
  /** Embedded clips indexed by the existing runtime sprite clip slots. */
  readonly animation?: {
    readonly clips: readonly AnimationClip[];
    readonly names?: Readonly<Record<string, string>>;
    readonly classicCycle?: boolean;
  };
}

const [, HOP, ACTION, EAT] = RABBIT_CLIPS;

const meshes = new Map<string, WildlifeMeshDefinition>([
  [
    RABBIT_TYPE,
    {
      path: "assets/models/experiments/rabbit.glb",
      height: 11,
      topDown: { width: 1.4, height: 0.74 },
      pose(part, frame, rotation) {
        const hop = frame - HOP.start;
        if (hop >= 0 && hop < HOP.count) {
          const swing = part.startsWith("FRONT_")
            ? -0.55
            : part.startsWith("HIND_")
              ? 0.5
              : part.startsWith("EAR_")
                ? 0.25
                : 0;
          rotation.x = swing * Math.sin((hop / (HOP.count - 1)) * Math.PI);
        } else if (part === "HEAD" && frame >= ACTION.start) {
          const eat = frame - EAT.start;
          rotation.x = eat >= 0 ? -0.35 + 0.12 * (eat % 2) : -0.2;
        }
      },
    },
  ],
]);

const query = new URLSearchParams(globalThis.location?.search);
const reviewId = query.get("wildlife3dReview");
const isPreview = ({ id, batch }: { id: string; batch: string }) =>
  id === reviewId || batch === reviewId;
const selected = new Map(WILDLIFE_MODEL_REVIEWS.map((model) => [model.type, model]));
for (const review of WILDLIFE_MODEL_REVIEWS)
  if (isPreview(review)) selected.set(review.type, review);

for (const review of selected.values()) {
  const sprite = ENTITY_DEFS[review.type]?.sprite;
  if (!sprite) throw new Error(`Missing wildlife sprite: ${review.type}`);
  const clips = wildlifeModelClips(review.type, review.classicTravel);
  if (!clips) throw new Error(`Missing wildlife clips: ${review.type}`);
  meshes.set(sprite.sheetKey, {
    path: wildlifeModelReviewPath(review.id, "model.glb"),
    height: 1,
    unitScale: review.scale,
    topDown: review.topDown,
    animation: {
      clips,
      ...(review.actions ? { names: review.actions } : {}),
      classicCycle: !sprite.clips,
    },
  });
}

// Local development preview for the original campaign drafts.
if (
  import.meta.env?.DEV &&
  typeof window !== "undefined" &&
  query.get("wildlife3dDrafts") === "1"
) {
  const type = faunaType("cat");
  const clips = FAUNA_DEFS[type]?.sprite?.clips;
  if (clips)
    meshes.set(type, {
      path: "assets/models/experiments/cat.glb",
      height: 12.6,
      topDown: { width: 1.015, height: 0.776 },
      animation: {
        clips,
        names: {
          idle: "Idle",
          walk: "Walk",
          action: "Action",
          flee: "Walk",
          stalk: "Stalk",
          pounce: "Pounce",
          bat: "Bat",
          climb: "Climb",
          sit: "Sit",
        },
      },
    });
  const catalog = document.querySelector("#tilefun-wildlife-draft-catalog")?.textContent;
  if (catalog) {
    const drafts = JSON.parse(catalog) as Record<string, WildlifeMeshDefinition>;
    for (const [type, definition] of Object.entries(drafts)) meshes.set(type, definition);
  }
}

export const WILDLIFE_MESHES: ReadonlyMap<string, WildlifeMeshDefinition> = meshes;
