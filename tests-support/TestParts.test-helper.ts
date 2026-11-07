import { readdirSync } from "node:fs";
import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PART_FILE = /^(.+)\.part([1-9]\d*)\.test\.ts$/;

/**
 * Vitest parallelizes and shards by file, so a long per-case matrix in one file
 * sets the run's floor. A suite split across sibling `Name.partN.test.ts` files
 * calls this with the part file's `import.meta.url`. The part count is the number
 * of sibling part files, and each part takes a deterministic round-robin slice,
 * so every case runs in exactly one part. Adding or removing a trailing part file
 * rebalances the cases; a numbering gap fails collection instead of dropping cases.
 */
export function testPart<T>(cases: readonly T[], partFileUrl: string): T[] {
  const path = fileURLToPath(partFileUrl);
  const [, name, number] = PART_FILE.exec(basename(path)) ?? [];
  if (!name) throw new Error(`${path} is not named Name.partN.test.ts`);
  const parts = readdirSync(dirname(path)).filter(
    (file) => PART_FILE.exec(file)?.[1] === name,
  ).length;
  const part = Number(number);
  if (part > parts) throw new Error(`${path} is part ${part} of ${parts}: renumber the parts`);
  return cases.filter((_, index) => index % parts === part - 1);
}
