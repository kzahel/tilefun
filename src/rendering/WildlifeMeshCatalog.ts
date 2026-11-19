import type { Euler } from "three";
import { RABBIT_CLIPS, RABBIT_TYPE } from "../wildlife/Rabbit.js";

export interface WildlifeMeshDefinition {
  /** Self-contained GLB with feet on local ground and forward along glTF −Z. */
  readonly path: string;
  readonly height: number;
  /** Asset-local width and height registration for the oblique gameplay view. */
  readonly topDown?: { readonly width: number; readonly height: number };
  /** Local rotation relative to the part's GLB pose, driven by the existing sprite frame. */
  readonly pose?: (part: string, frame: number, rotation: Euler) => void;
}

const [, HOP, ACTION, EAT] = RABBIT_CLIPS;

export const WILDLIFE_MESHES: ReadonlyMap<string, WildlifeMeshDefinition> = new Map([
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
