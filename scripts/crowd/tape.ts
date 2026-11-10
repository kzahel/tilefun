import { readFile, writeFile } from "node:fs/promises";
import { deserialize, serialize } from "node:v8";
import type { ScenarioRecipe } from "../../src/scenarios/ScenarioRecipe.js";
import { sha256 } from "./report.js";

export interface CrowdTape {
  version: 1;
  recipe: ScenarioRecipe;
  recipeSha256: string;
  warmup: number;
  ticks: number;
  initial: ArrayBuffer[];
  steps: ArrayBuffer[][];
  source: unknown;
}
export async function writeTape(file: string, tape: CrowdTape) {
  const bytes = serialize(tape);
  await writeFile(file, bytes);
  return sha256(bytes);
}
export async function readTape(file: string) {
  const bytes = await readFile(file);
  const tape = deserialize(bytes) as CrowdTape;
  if (
    tape.version !== 1 ||
    !Number.isInteger(tape.warmup) ||
    tape.warmup < 1 ||
    !Number.isInteger(tape.ticks) ||
    tape.ticks < 1 ||
    tape.warmup + tape.ticks > 20_000 ||
    tape.recipeSha256 !== sha256(JSON.stringify(tape.recipe)) ||
    !Array.isArray(tape.initial) ||
    !Array.isArray(tape.steps) ||
    tape.steps.length !== tape.warmup + tape.ticks ||
    ![tape.initial, ...tape.steps].every(
      (packets) => Array.isArray(packets) && packets.every((p) => p instanceof ArrayBuffer),
    )
  )
    throw Error("Invalid crowd recording");
  return { tape, sha256: sha256(bytes) };
}
