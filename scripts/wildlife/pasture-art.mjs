import { readFileSync, writeFileSync } from "node:fs";

const data = {};
for (const animal of ["goat", "piglet", "elephant"]) {
  const base = `demos/wildlife-v2/${animal}/behavior-v1`,
    m = JSON.parse(readFileSync(`public/${base}/sprite.json`)),
    inputs = JSON.parse(readFileSync(`art-source/wildlife-v2/${animal}/behavior-v1/inputs.json`)),
    projection = JSON.parse(
      readFileSync(
        inputs.projection ?? `art-source/wildlife-v2/${animal}/behavior-v1/projection.json`,
      ),
    );
  const names = new Set(projection.records.map((r) => r.clip)),
    sockets = [[], [], [], []];
  for (const r of projection.records)
    sockets[["down", "up", "left", "right"].indexOf(r.facing)][m.clips[r.clip].start + r.index] =
      r.socket.slice(0, 2).map((v, i) => Math.round((v - m.anchor[i]) * 100) / 100);
  data[animal] = {
    identity: m.identity,
    sha256: m.sheetSha256,
    image: `${base}/sheet.png`,
    clips: Object.fromEntries(Object.entries(m.clips).filter(([k]) => names.has(k))),
    sockets,
  };
}
writeFileSync("src/wildlife/pasture-art.json", JSON.stringify(data, null, 2) + "\n");
