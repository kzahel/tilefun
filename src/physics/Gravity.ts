/** The sole replicated physics tuning value. Each JS realm owns its copy. */
let gravityScale = 1;
let revision = 0;
export function getGravityScale() {
  return gravityScale;
}
export function getGravityRevision() {
  return revision;
}
export function setGravityScale(value: number) {
  if (!Number.isFinite(value) || value < 0) throw Error("Invalid gravity scale");
  if (value !== gravityScale) {
    gravityScale = value;
    revision++;
  }
}
