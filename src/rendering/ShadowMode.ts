/** Opt-in experiment (tactical 236): `?shadows=gpu` draws actor oval shadows in a
 * GPU pass that reads the finished world's depth, instead of clipping every
 * footprint against surface receivers on the CPU each frame. Vehicles, particles
 * and landing rings keep the projected path. Benchmarks may set it directly. */
export const shadowMode = {
  gpu:
    typeof location !== "undefined" &&
    new URLSearchParams(location.search).get("shadows") === "gpu",
};
