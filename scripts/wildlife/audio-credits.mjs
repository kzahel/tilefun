import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const root = "art-source/animal-audio";
const lines = [
  "Tilefun animal recording credits",
  "",
  "Recordings are trimmed, filtered, gain-adjusted, faded and converted to mono OGG/Vorbis.",
  "No endorsement by the creators is implied. Exact edits, source/export hashes and",
  "license receipts are retained in art-source/animal-audio/<bank>/manifest.json.",
  "CC0 sources also retain creator credit. Listening review is separate from licensing.",
  "",
];
for (const bank of readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name))) {
  const receipt = JSON.parse(readFileSync(`${root}/${bank.name}/manifest.json`, "utf8"));
  for (const source of receipt.sources) {
    lines.push(
      `${source.id} (${bank.name})`,
      `Creator: ${source.creator}`,
      `Source: ${source.sourcePage}`,
      `License: ${source.license} — ${source.licenseUrl}`,
    );
    if (source.upstream) lines.push(`Upstream: ${source.upstream}`);
    lines.push("");
  }
}
const path = "public/assets/audio/animals/CREDITS.txt";
const text = lines.join("\n");
if (process.argv.includes("--check")) {
  if (readFileSync(path, "utf8").replaceAll("\r\n", "\n") !== text)
    throw Error("Animal recording credits are stale");
} else writeFileSync(path, text);
console.log(
  `Animal credits current: ${lines.filter((line) => line.startsWith("Creator:")).length} sources`,
);
