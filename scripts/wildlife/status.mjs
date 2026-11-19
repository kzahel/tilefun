import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const OUTPUT = "docs/wildlife-status.md";
const read = (path) => JSON.parse(readFileSync(resolve(ROOT, path), "utf8"));

function renderStatus() {
  const art = read("art-source/wildlife-v2/autonomous-147.json");
  const artTasks = Object.values(art.tasks);
  const activeArt = artTasks.filter(
    ({ state }) => state === "finished-game-active" || state === "already-completed",
  ).length;
  const paint = read("art-source/wildlife-v2/finishing-progress.json");

  const behavior = read("art-source/wildlife-v2/behavior-campaign.json");
  const behaviorEntries = Object.values(behavior.animals);
  const verified = behaviorEntries.filter(({ progress }) => progress.validation === "verified");
  const inProgress = behaviorEntries.filter(({ progress }) =>
    Object.values(progress).includes("in-progress"),
  );

  const audio = read("art-source/animal-audio/sound-campaign.json");
  const audioEntries = Object.entries(audio.animals);
  const integrated = audioEntries.filter(([, { state }]) => state === "integrated");
  const gaps = new Set(Object.keys(audio.sourceGaps ?? {}));
  for (const [id, { state }] of audioEntries) if (state === "source-gap") gaps.add(id);

  return [
    "# Wildlife status",
    "",
    "[Animal Browser and AI playground](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-tiger&landscape=balanced#/tool/world-geometry)",
    "",
    "| Area | Progress | Details |",
    "| --- | --- | --- |",
    `| Art roster | ${activeArt}/${artTasks.length} active in game | [Roster completion](tactical/${art.tactical}) |`,
    `| Pixel-art finishing | ${paint.corrected} corrected sprite banks | [Finishing and art review](tactical/187-shared-wildlife-finishing.md) |`,
    `| Distinct behaviors | ${verified.length}/${behaviorEntries.length} verified in game or lab, ${inProgress.length} in progress | [Behavior progress](wildlife-behavior-status.md) |`,
    `| Animal sounds | ${integrated.length}/${audioEntries.length} integrated, ${gaps.size} documented source gaps | [Sound audit](wildlife-audio-audit.md) |`,
    "",
    "Human art and listening reviews are tracked in the owning records.",
    "",
    "[Wildlife topic](topics/wildlife.md) · [Historical production snapshot](archive/wildlife-production-status.md)",
    "",
    "Regenerate with `node scripts/wildlife/status.mjs` after changing a linked ledger.",
    "",
  ].join("\n");
}

export function writeStatus() {
  const output = resolve(ROOT, OUTPUT);
  const temporary = `${output}.${process.pid}.tmp`;
  writeFileSync(temporary, renderStatus());
  renameSync(temporary, output);
  return { path: OUTPUT };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    if (readFileSync(resolve(ROOT, OUTPUT), "utf8") !== renderStatus())
      throw new Error("Wildlife status is stale. Run node scripts/wildlife/status.mjs.");
    console.log("Wildlife status is current.");
  } else {
    console.log(JSON.stringify(writeStatus()));
  }
}
