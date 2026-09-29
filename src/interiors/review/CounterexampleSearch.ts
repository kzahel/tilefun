import { type AuditIssue, auditCase } from "./CounterexampleAudit.js";
import {
  caseIdentity,
  generateProbe,
  interactionFeatures,
  PROBE_COUNT,
  type Probe,
} from "./CounterexampleGenerator.js";
import type { ReviewCase } from "./ReviewCases.js";

export interface SearchResult {
  enumerated: number;
  duplicates: number;
  known: number;
  valid: number;
  failures: { seed: number; issues: AuditIssue[] }[];
  selected: { seed: number; family: number; newFeatures: number; fixture: Probe }[];
}
/** Offline greedy coverage selection. Browser code imports only the chosen seeds. */
export function searchCounterexamples(
  knownCases: ReviewCase[],
  count = 8,
  limit = PROBE_COUNT,
): SearchResult {
  if (!Number.isInteger(count) || count < 1 || count > 32)
    throw new Error("Review count must be between 1 and 32");
  if (!Number.isInteger(limit) || limit < 1 || limit > PROBE_COUNT)
    throw new Error("Invalid search limit");
  const result: SearchResult = {
    enumerated: 0,
    duplicates: 0,
    known: 0,
    valid: 0,
    failures: [],
    selected: [],
  };
  const seen = new Set<string>(),
    known = new Set(knownCases.map(caseIdentity));
  const coverage = new Set(knownCases.flatMap((c) => [...interactionFeatures(c)]));
  const candidates: { fixture: Probe; features: Set<string> }[] = [];
  for (let seed = 0; seed < Math.min(limit, PROBE_COUNT); seed++) {
    result.enumerated++;
    const fixture = generateProbe(seed),
      id = caseIdentity(fixture);
    if (seen.has(id)) {
      result.duplicates++;
      continue;
    }
    seen.add(id);
    if (known.has(id)) {
      result.known++;
      continue;
    }
    const issues = auditCase(fixture);
    if (issues.length) {
      result.failures.push({ seed, issues });
      continue;
    }
    result.valid++;
    candidates.push({ fixture, features: interactionFeatures(fixture) });
  }
  const families = new Map<number, number>();
  while (result.selected.length < count) {
    const ranked = candidates
      .map((c) => ({ ...c, novel: [...c.features].filter((f) => !coverage.has(f)).length }))
      .filter((c) => c.novel > 0 && (families.get(c.fixture.family) ?? 0) < Math.ceil(count / 4))
      .sort(
        (a, b) =>
          b.novel - a.novel ||
          a.fixture.sketch.length - b.fixture.sketch.length ||
          a.fixture.profiles.walls.length - b.fixture.profiles.walls.length ||
          a.fixture.seed - b.fixture.seed,
      );
    const next = ranked[0];
    if (!next) break;
    result.selected.push({
      seed: next.fixture.seed,
      family: next.fixture.family,
      newFeatures: next.novel,
      fixture: next.fixture,
    });
    for (const f of next.features) coverage.add(f);
    families.set(next.fixture.family, (families.get(next.fixture.family) ?? 0) + 1);
    candidates.splice(
      candidates.findIndex((c) => c.fixture.seed === next.fixture.seed),
      1,
    );
  }
  return result;
}
