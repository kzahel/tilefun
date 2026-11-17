import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const atlasDir = fileURLToPath(new URL("../public/assets/tilesets/", import.meta.url));
const manifestPath = new URL("./game-atlases.sha256.json", import.meta.url);
const atlases = ["me-complete", "modern-interiors-atlas"];

function fingerprint(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function fingerprints() {
  return Object.fromEntries(
    atlases.flatMap((atlas) =>
      ["png", "webp"].map((extension) => {
        const file = `${atlas}.${extension}`;
        return [file, fingerprint(join(atlasDir, file))];
      }),
    ),
  );
}

if (process.argv.includes("--check")) {
  const expected = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const [file, sha256] of Object.entries(fingerprints())) {
    if (sha256 !== expected[file]) {
      throw Error(`Game atlas changed: ${file}. Run npm run assets:game-atlases.`);
    }
  }
} else {
  const stagingDir = mkdtempSync(join(tmpdir(), "tilefun-game-atlases-"));
  try {
    for (const atlas of atlases) {
      const source = join(atlasDir, `${atlas}.png`);
      const encoded = join(stagingDir, `${atlas}.webp`);
      const decoded = join(stagingDir, `${atlas}.png`);
      execFileSync("cwebp", ["-quiet", "-lossless", "-exact", "-z", "3", source, "-o", encoded]);
      execFileSync("dwebp", ["-quiet", encoded, "-o", decoded]);
      const original = PNG.sync.read(readFileSync(source));
      const copy = PNG.sync.read(readFileSync(decoded));
      if (
        copy.width !== original.width ||
        copy.height !== original.height ||
        !copy.data.equals(original.data)
      ) {
        throw Error(`Game atlas pixels differ: ${atlas}`);
      }
    }
    for (const atlas of atlases) {
      const file = `${atlas}.webp`;
      copyFileSync(join(stagingDir, file), join(atlasDir, file));
    }
    writeFileSync(manifestPath, `${JSON.stringify(fingerprints(), null, 2)}\n`);
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
  }
}
