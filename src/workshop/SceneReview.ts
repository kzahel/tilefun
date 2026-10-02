import type { WorkshopCandidate } from "./WorkshopTypes.js";
/** Whole scenes are review units. Historical crop identities remain accessible. */
export const SCENE_ROOTS: Record<string, string> = {
  districts: "district-v1-neighborhood",
  commercial: "district-v2-commercial",
  parking: "district-v7-parking-block",
  parks: "district-v8-public-block",
  architecture: "district-v9-architecture",
  pedestrians: "district-v10-destinations",
};
export function primaryScene(c: WorkshopCandidate) {
  return c.review?.scene === "district" ? SCENE_ROOTS[c.batchId] : undefined;
}
export function reviewUnits<T extends WorkshopCandidate>(rows: T[]) {
  return rows.filter((c) => !primaryScene(c) || c.review?.caseId === primaryScene(c));
}
export function scenePath(c: WorkshopCandidate) {
  const root = primaryScene(c);
  return root
    ? `/scene/${encodeURIComponent(root)}${root === c.review?.caseId ? "" : `?focus=${encodeURIComponent(c.review?.caseId ?? "")}`}`
    : `/review/${encodeURIComponent(c.id)}`;
}
