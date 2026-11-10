/** Actor ovals and mesh vehicle shadows are drawn in a GPU pass that reads the
 * finished world's depth (tactical 236), instead of clipping every footprint
 * against surface receivers on the CPU each frame. `?shadows=projected` keeps
 * the projected decals for comparison; benchmarks and tests may set it directly.
 * Particles, landing rings, boats and trains always use the projected path. */
export const shadowMode = {
  gpu:
    typeof location === "undefined" ||
    new URLSearchParams(location.search).get("shadows") !== "projected",
};
