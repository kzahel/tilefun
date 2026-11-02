import RAPIER from "@dimforge/rapier3d-compat";

export const PHYSICS_DT = 1 / 60;
export const PHYSICS_PIXELS_PER_METRE = 16;
let initialization: Promise<void> | undefined;
/** One WASM initialization per JS realm; authority and prediction have private memory. */
export const initializePhysics = () => (initialization ??= RAPIER.init());
