import { readFileSync, writeFileSync } from "node:fs";

const data = {};
for (const animal of ["hedgehog", "porcupine", "fox"]) {
  const base = `demos/wildlife-v2/${animal}/behavior-v1`,
    metadata = JSON.parse(readFileSync(`public/${base}/sprite.json`)),
    projection = JSON.parse(
      readFileSync(`art-source/wildlife-v2/${animal}/behavior-v1/projection.json`),
    );
  const names = new Set(projection.records.map((r) => r.clip)),
    sockets = [[], [], [], []];
  for (const r of projection.nativeSockets ?? [])
    sockets[["down", "up", "left", "right"].indexOf(r.facing)][r.column] = r.socket
      .slice(0, 2)
      .map((v, i) => Math.round((v - metadata.anchor[i]) * 100) / 100);
  for (const r of projection.records)
    sockets[["down", "up", "left", "right"].indexOf(r.facing)][
      metadata.clips[r.clip].start + r.index
    ] = r.socket.slice(0, 2).map((v, i) => Math.round((v - metadata.anchor[i]) * 100) / 100);
  data[animal] = {
    identity: metadata.identity,
    sha256: metadata.sheetSha256,
    image: `${base}/sheet.png`,
    clips: Object.fromEntries(Object.entries(metadata.clips).filter(([name]) => names.has(name))),
    sockets,
  };
}
writeFileSync("src/wildlife/threat-art.json", `${JSON.stringify(data, null, 2)}\n`);
