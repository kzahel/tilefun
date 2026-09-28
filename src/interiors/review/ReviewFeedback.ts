export interface ReviewFeedback {
  id: string;
  caseId: string;
  fingerprint: string;
  verdict: "good" | "wrong" | "clear";
  note: string;
  sketch: string;
  name: string;
  createdAt: string;
  screenshot?: string;
}
export function parseReviewFeedback(value: unknown): ReviewFeedback {
  if (!value || typeof value !== "object") throw new Error("Invalid feedback");
  const v = value as Record<string, unknown>;
  for (const [key, limit] of Object.entries({
    id: 100,
    caseId: 100,
    fingerprint: 64,
    note: 2000,
    sketch: 6000,
    name: 200,
    createdAt: 40,
  })) {
    if (typeof v[key] !== "string" || (v[key] as string).length > limit)
      throw new Error(`Invalid ${key}`);
  }
  if (
    !/^[a-zA-Z0-9-]+$/.test(v.id as string) ||
    !/^[a-zA-Z0-9-]+$/.test(v.caseId as string) ||
    !/^[a-f0-9]{64}$/.test(v.fingerprint as string)
  )
    throw new Error("Invalid feedback identity");
  if (!["good", "wrong", "clear"].includes(v.verdict as string)) throw new Error("Invalid verdict");
  if (
    v.screenshot !== undefined &&
    (typeof v.screenshot !== "string" ||
      v.screenshot.length > 700_000 ||
      !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v.screenshot))
  )
    throw new Error("Invalid screenshot");
  return {
    id: v.id as string,
    caseId: v.caseId as string,
    fingerprint: v.fingerprint as string,
    verdict: v.verdict as ReviewFeedback["verdict"],
    note: v.note as string,
    sketch: v.sketch as string,
    name: v.name as string,
    createdAt: v.createdAt as string,
    ...(typeof v.screenshot === "string" ? { screenshot: v.screenshot } : {}),
  };
}
/** Only judgments of these exact pixels and this exact plan remain current. */
export function currentVerdict(
  records: ReviewFeedback[],
  caseId: string,
  fingerprint: string,
): ReviewFeedback | undefined {
  const latest = [...records].reverse().find((r) => r.caseId === caseId);
  return latest?.fingerprint === fingerprint && latest.verdict !== "clear" ? latest : undefined;
}
