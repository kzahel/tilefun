import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const data = {};
for (const species of ["rabbit", "robin", "meerkat"]) {
  const base = `demos/wildlife-v2/${species}/behavior-v1`;
  const m = JSON.parse(readFileSync(`public/${base}/sprite.json`, "utf8"));
  data[species] = {
    identity: m.identity,
    sha256: m.sheetSha256,
    image: `${base}/sheet.png`,
    clips: Object.fromEntries(
      Object.entries(m.clips)
        .filter(([name]) => ["eat", "scan", "alarm", "rear", "lower"].includes(name))
        .map(([name, c]) => [name, { ...c, loop: name === "scan" }]),
    ),
    sockets: [[], [], [], []],
  };
}
const file = "src/wildlife/meadow-art.json",
  content = `${JSON.stringify(data, null, 2)}\n`;
if (process.argv.includes("--check")) assert.equal(readFileSync(file, "utf8"), content);
else writeFileSync(file, content);
