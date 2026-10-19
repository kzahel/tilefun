/** Original vehicle queue only; existing sprite-port and wildlife counts are separate. */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
const roster = JSON.parse(
  await readFile(new URL("art-source/vehicle-bake/roster.json", root), "utf8"),
);
const vehicles = [...roster.vehicles].sort((a, b) => a.priority - b.priority);
const counts = Object.entries(
  vehicles.reduce((result, car) => {
    result[car.status] = (result[car.status] ?? 0) + 1;
    return result;
  }, {}),
)
  .map(([state, count]) => `${count} ${state}`)
  .join(" · ");
const rows = vehicles.map(
  (car) => `| ${car.priority} | ${car.name} | ${car.family} | ${car.status} | ${car.next} |`,
);
const text = [
  "# Original vehicle authoring status",
  "",
  "Generated from [the roster](../art-source/vehicle-bake/roster.json) by `node scripts/vehicle-bake/status.mjs`.",
  "",
  `**${counts}.**`,
  "",
  roster.gate,
  "",
  "[Current red-car pilot](tactical/142-red-car-low-poly-pipeline.md) · [Pipeline topic](topics/original-vehicles.md)",
  "",
  "| Priority | Vehicle | Family | State | Next step |",
  "| ---: | --- | --- | --- | --- |",
  ...rows,
  "",
  "Authorization lives in each roster entry; idea entries remain proposals. Exact model review and gameplay activation are separate checkpoints.",
  "",
].join("\n");
await writeFile(new URL("docs/vehicle-status.md", root), text);
console.log(
  `${vehicles.length} original vehicle entries → ${fileURLToPath(new URL("docs/vehicle-status.md", root))}`,
);
