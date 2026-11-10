import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

export const REPORT_VERSION = 2;
export const round = (v: number) => Math.round(v * 1000) / 1000;
export const sha256 = (data: string | Uint8Array) =>
  createHash("sha256").update(data).digest("hex");

export function summarize(values: readonly number[]) {
  if (!values.length) throw Error("Cannot summarize an empty measurement window");
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
  return {
    count: sorted.length,
    totalMs: round(sorted.reduce((a, b) => a + b, 0)),
    mean: round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
    p50: round(at(0.5)),
    p95: round(at(0.95)),
    p99: round(at(0.99)),
    max: round(at(1)),
  };
}

export interface ComparableReport {
  schemaVersion: number;
  lane: string;
  workload: unknown;
  environment: unknown;
  instrumentation: unknown;
}

/** Source revisions may differ; workload, machine/runtime and observation mode must match. */
export function comparisonIssues(now: ComparableReport, before: ComparableReport): string[] {
  return (["schemaVersion", "lane", "workload", "environment", "instrumentation"] as const)
    .filter((key) => !isDeepStrictEqual(now[key], before[key]))
    .map((key) => `${key} differs`);
}

export function assertComparable(
  now: ComparableReport,
  before: ComparableReport,
  override: boolean,
): string[] {
  const issues = comparisonIssues(now, before);
  if (issues.length && !override)
    throw Error(
      `Incompatible comparison: ${issues.join(", ")}. Use --allow-incompatible to inspect it explicitly.`,
    );
  return issues;
}

export function delta(now: number, before?: number): string {
  return before === undefined
    ? ""
    : ` (was ${before}${before ? `, ${Math.round(((now - before) / before) * 100)}%` : ""})`;
}

/** Compare observed output separately from workload compatibility and timing. */
export function compareOutcome(now: unknown, before: unknown, required: boolean) {
  const matches = before === undefined ? null : isDeepStrictEqual(now, before);
  if (required && matches !== true)
    throw Error("Recorded outcomes differ or comparison outcome is missing");
  return matches;
}
