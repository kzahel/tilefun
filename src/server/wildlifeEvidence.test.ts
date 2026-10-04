import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { verifyWildlifeEvidence } from "./wildlifeEvidence.js";

it("requires exact archived animation evidence even when build render inputs are intact", async () => {
  const root = await mkdtemp(join(tmpdir(), "wildlife-evidence-"));
  try {
    await mkdir(join(root, "src/wildlife"), { recursive: true });
    await mkdir(join(root, "public"));
    const files = ["sheet.png", "preview.gif"].map((path) => ({
      path,
      sha256: createHash("sha256").update(path).digest("hex"),
    }));
    await writeFile(
      join(root, "src/wildlife/reviews.json"),
      JSON.stringify([{ id: "sheep", files }]),
    );
    for (const file of files) await writeFile(join(root, "public", file.path), file.path);
    await expect(
      verifyWildlifeEvidence("pattern:wildlife-v2-sheep", root),
    ).resolves.toBeUndefined();
    await writeFile(join(root, "public/preview.gif"), "changed motion");
    await expect(verifyWildlifeEvidence("pattern:wildlife-v2-sheep", root)).rejects.toThrow(
      "Wildlife artifact changed: preview.gif",
    );
    await rm(join(root, "public/preview.gif"));
    await expect(verifyWildlifeEvidence("pattern:wildlife-v2-sheep", root)).rejects.toThrow(
      "Wildlife artifact changed: preview.gif",
    );
    await expect(verifyWildlifeEvidence("pattern:wildlife-v2-unknown", root)).rejects.toThrow(
      "Unknown wildlife evidence",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
