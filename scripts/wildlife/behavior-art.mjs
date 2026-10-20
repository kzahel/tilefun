// Explicit source projection -> runtime attachment bank. Builds use committed data.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const result = {};
for (const species of ["dog", "crow", "red-squirrel"]) {
  const source = `art-source/wildlife-v2/${species}/behavior-v1`;
  const output = `public/demos/wildlife-v2/${species}/behavior-v1`;
  const metadata = JSON.parse(readFileSync(`${output}/sprite.json`, "utf8"));
  const projection = JSON.parse(
    species === "dog"
      ? gunzipSync(readFileSync(`${source}/projection.json.gz`)).toString("utf8")
      : readFileSync(`${source}/projection.json`, "utf8"),
  );
  const sockets = Array.from({ length: 4 }, () => []);
  const facings = ["down", "up", "left", "right"];
  for (const record of projection.records) {
    const column = metadata.clips[record.clip].start + record.index;
    sockets[facings.indexOf(record.facing)][column] = record.socket
      .slice(0, 2)
      .map((value, index) => Math.round((value - metadata.anchor[index]) * 100) / 100);
  }
  result[species] = {
    identity: metadata.identity,
    sha256: metadata.sheetSha256,
    image: `demos/wildlife-v2/${species}/behavior-v1/sheet.png`,
    clips: metadata.clips,
    sockets,
  };
}
const file = "src/wildlife/behavior-art.json",
  content = `${JSON.stringify(result, null, 2)}\n`;
if (process.argv.includes("--check")) assert.equal(readFileSync(file, "utf8"), content);
else writeFileSync(file, content);
