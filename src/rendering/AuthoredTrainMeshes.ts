/** Inspection-only registrations. Main-game train sprites remain the default. */
export const AUTHORED_TRAIN_MESHES = (["rear", "middle", "front"] as const).map((part) => ({
  part,
  assetId: `train-blue-${part}-authored-v3`,
  path: `assets/models/trains/blue-${part}-v3.glb`,
  radius: 112,
  // Static source-side registration: the train atlas observes +Y from the
  // fixed game lens. Reflect lateral paint once, before track orientation.
  lateralScale: -1,
}));
export function authoredTrainForAsset(assetId: string) {
  return AUTHORED_TRAIN_MESHES.find((d) => d.assetId === assetId);
}
export function authoredTrainForType(type: string) {
  const part =
    type === "train-curve-proof-v1:rear" || type === "train-carriage-v1:left"
      ? "rear"
      : type === "train-curve-proof-v1" || type === "train-carriage-v1:middle"
        ? "middle"
        : type === "train-curve-proof-v1:front" || type === "train-carriage-v1:right"
          ? "front"
          : undefined;
  return AUTHORED_TRAIN_MESHES.find((d) => d.part === part);
}
