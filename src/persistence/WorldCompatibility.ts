import {
  createDescriptor,
  descriptorChoice,
  descriptorFromMetadata,
  isCurrentGeneration,
} from "../generation/GenerationDescriptor.js";
import type { WorldMeta } from "./IWorldRegistry.js";
import { SAVE_FORMAT } from "./SaveFormat.js";

export function worldCompatibility(meta: WorldMeta): string | undefined {
  if (meta.saveFormat !== SAVE_FORMAT) return "Older save format — recreate to play.";
  try {
    if (!isCurrentGeneration(descriptorFromMetadata(meta)))
      return "Retired generator — recreate to play.";
  } catch {
    return "Unsupported generator — recreate to play.";
  }
  return undefined;
}

/** New ID/container, same seed. Never mixes old edits, interiors or actors with new terrain. */
export function recreationGeneration(meta: WorldMeta) {
  const previous = descriptorFromMetadata(meta);
  return createDescriptor(
    descriptorChoice(previous),
    previous.seed,
    previous.type === "classic" ? previous.roads : undefined,
  );
}
