import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const SNAPSHOTS = "art-source/vehicle-bake/replay-inputs/";
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/** Historical receipts describe their original environment, not today's engine.
 * Only an explicitly registered, byte-identical retained snapshot can substitute
 * for an evolved input. This never changes the file loaded by the live game.
 */
export function readRetainedReplayInput(root: string, path: string, expected: string): Buffer {
  const repository = realpathSync(root);
  const contained = (name: string) => {
    if (
      !name ||
      name.includes("\\") ||
      name.includes(":") ||
      name.split("/").some((part) => !part || part === ".." || part === ".") ||
      /^(data|test-results)\//.test(name)
    )
      throw new Error(`Invalid retained input path: ${name}`);
    const target = resolve(repository, name);
    if (existsSync(target)) {
      const actual = relative(repository, realpathSync(target));
      if (isAbsolute(actual) || actual === ".." || actual.startsWith(`..${sep}`))
        throw new Error(`Retained input escapes repository: ${name}`);
    }
    return target;
  };
  if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error("Invalid retained input digest");
  const current = contained(path);
  if (existsSync(current)) {
    const bytes = readFileSync(current);
    if (digest(bytes) === expected) return bytes;
  }
  const catalogPath = contained(`${SNAPSHOTS}catalog.json`);
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as {
    version: number;
    inputs: { path: string; sha256: string; snapshot: string }[];
  };
  if (catalog.version !== 1 || !Array.isArray(catalog.inputs))
    throw new Error("Invalid retained replay catalog");
  const matches = catalog.inputs.filter(
    (entry) => entry.path === path && entry.sha256 === expected,
  );
  if (matches.length !== 1) throw new Error(`Unregistered historical input: ${path} (${expected})`);
  const snapshot = matches[0]?.snapshot;
  if (typeof snapshot !== "string" || !snapshot.startsWith(SNAPSHOTS))
    throw new Error(`Invalid historical snapshot: ${path}`);
  const bytes = readFileSync(contained(snapshot));
  if (digest(bytes) !== expected) throw new Error(`Stale historical snapshot: ${path}`);
  return bytes;
}
