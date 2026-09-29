import { readFileSync, writeFileSync } from "node:fs";
import { FURNITURE_CATALOG } from "../src/interiors/FurnitureCatalog.js";

const index = JSON.parse(readFileSync("public/data/modern-interiors-atlas.json", "utf8")) as {
  entries: { key: string; rect: number[] }[];
};
const entries = new Map(index.entries.map((entry) => [entry.key, entry.rect]));
const facts = Object.fromEntries(
  FURNITURE_CATALOG.map((def) => {
    const rect = entries.get(def.key);
    if (!rect || rect[2] !== def.size[0] || rect[3] !== def.size[1])
      throw new Error(`Invalid source sprite: ${def.key}`);
    return [def.id, rect];
  }),
);
const path = "src/interiors/gameplay-furniture-sources.json";
const output = `${JSON.stringify(facts, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (JSON.stringify(JSON.parse(readFileSync(path, "utf8"))) !== JSON.stringify(facts))
    throw new Error(
      "Gameplay furniture facts are stale. Run npx tsx scripts/build-gameplay-furniture.ts.",
    );
} else writeFileSync(path, output);
