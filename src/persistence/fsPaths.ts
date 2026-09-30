import { lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

function contains(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

/** Reject lexical traversal and existing symlinks that escape the configured root. */
export function containedPath(root: string, path: string): string {
  if (path.includes("\0") || path.includes("\\") || isAbsolute(path))
    throw new Error("Invalid storage path.");
  const resolvedRoot = resolve(root);
  const candidate = resolve(resolvedRoot, path);
  if (!contains(resolvedRoot, candidate)) throw new Error("Path outside storage root.");
  // lstat also sees dangling symlinks; existsSync would miss them before a write.
  const exists = (path: string) => lstatSync(path, { throwIfNoEntry: false }) !== undefined;
  if (exists(resolvedRoot)) {
    let ancestor = candidate;
    while (!exists(ancestor) && ancestor !== resolvedRoot) ancestor = dirname(ancestor);
    if (!contains(realpathSync(resolvedRoot), realpathSync(ancestor)))
      throw new Error("Symlink outside storage root.");
  }
  return candidate;
}

export function worldDirectory(dataDir: string, worldId: string): string {
  if (typeof worldId !== "string" || !/^[a-zA-Z0-9_%~-]{1,512}$/.test(worldId))
    throw new Error("Invalid world ID.");
  return containedPath(containedPath(dataDir, "worlds"), worldId);
}
