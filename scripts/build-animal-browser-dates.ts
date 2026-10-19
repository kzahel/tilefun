/** Explicit authoring inventory. Builds consume the committed dates without Git. */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { ANIMAL_BROWSER_ENTRIES } from "../src/workshop/AnimalBrowserData.js";

const gitArgs = [
  "log",
  "--format=@%cI",
  "--name-only",
  "--diff-filter=A",
  "--",
  "public/demos/wildlife-v2",
];
const output =
  process.platform === "win32"
    ? execFileSync(
        "wsl",
        [
          "--exec",
          "/usr/bin/git",
          "-C",
          process
            .cwd()
            .replace(/^([A-Za-z]):/, (_, drive: string) => `/mnt/${drive.toLowerCase()}`)
            .replaceAll("\\", "/"),
          ...gitArgs,
        ],
        { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
      )
    : execFileSync("git", gitArgs, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const additions = new Map<string, string>();
let date = "";
for (const line of output.split(/\r?\n/)) {
  if (line.startsWith("@")) date = new Date(line.slice(1)).toISOString();
  else if (line) additions.set(line, date);
}
const ledger = JSON.parse(readFileSync("art-source/wildlife-v2/autonomous-140.json", "utf8"));
const dates = Object.fromEntries(
  ANIMAL_BROWSER_ENTRIES.map((p) => {
    const bank = additions.get(`public/${p.image}`) ?? null;
    const task = ledger.tasks[p.id === "brown-bear" ? "bear" : p.id];
    // New species' ledger dates describe their actual addition; repairs keep the
    // original species date and use the newer bank date for the Updated sort.
    const original =
      [...additions]
        .filter(
          ([path]) =>
            path.startsWith(`public/demos/wildlife-v2/${p.id}/`) && path.endsWith("/sheet.png"),
        )
        .map(([, d]) => d)
        .sort()[0] ?? bank;
    const completed = task?.completedUtc ? new Date(task.completedUtc).toISOString() : null;
    const added = completed && (!original || completed < original) ? completed : original;
    return [
      p.id,
      {
        added,
        updated: completed ?? bank,
      },
    ];
  }),
);
writeFileSync("src/workshop/animal-browser-dates.json", `${JSON.stringify(dates, null, 2)}\n`);
console.log(
  `${Object.keys(dates).length} animal dates retained from committed history and the completion ledger.`,
);
