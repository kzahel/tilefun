/**
 * Review revision for engine-driven Workshop scenes (natural landscapes, world
 * geometry, physics, character lab, car projection and deferred vehicle labs).
 *
 * Their candidate identities hash their recipe/definition and art inputs plus
 * this value, never engine source text, so ordinary engine edits do not reopen
 * review. Bump it deliberately when an engine change should reopen review of
 * those scenes. Pixel-identity batches (buildings, rooms, wildlife, railways,
 * parking studies) are fingerprinted by rendered output and do not use it.
 */
export const ENGINE_REVIEW_REVISION = 1;
