/** The sole replicated physics tuning value. Each JS realm (Worker, page) owns one copy;
 * views sharing a page share it (see docs/topics/embedded-engine-labs.md). */
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
