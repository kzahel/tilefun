import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/**
 * Tactical 226 replaces the embedded lab shell with the game's device session
 * and views. The shell must not gain consumers while labs migrate: this list
 * only shrinks. Remove a file here when its lab moves onto the game view; never
 * add one. `ScenarioSession` and `ScenarioProtocol` command types stay as the
 * headless harness and are not part of the shell. Indirect use through an
 * allowed file (a re-export or wrapper) is a review item, not detected here.
 */
const SHELL =
  /(?:from\s+|import\s*\(?\s*|new URL\(\s*|vi\.mock\(\s*)["'][^"']*\/(?:ScenarioPresentationHost|ScenarioClient|ScenarioWorkerHost|ScenarioReplica|scenario\.worker)(?:\.js|\.ts)?(?:\?[^"']*)?["']/;
const SHELL_AND_GUARD = new Set([
  "src/scenarios/LabShellConsumers.test.ts", // this guard's own import samples
  "src/scenarios/ScenarioPresentationHost.ts",
  "src/scenarios/ScenarioClient.ts",
  "src/scenarios/ScenarioWorkerHost.ts",
  "src/scenarios/ScenarioReplica.ts",
  "src/scenarios/scenario.worker.ts",
]);
const REMAINING_CONSUMERS = [
  "src/interiors/playtest/main.ts",
  "src/scenarios/CoopWorker.test.ts",
  "src/scenarios/ScenarioPresentationHost.test.ts",
  "src/scenarios/ScenarioScheduling.test.ts",
  "src/scenarios/ScenarioWorkerHost.test.ts",
  "src/workshop/CharacterPresentation.ts",
  "src/workshop/CharactersPage.tsx",
  "src/workshop/NaturalLandscapePage.tsx",
  "src/workshop/PhysicsPage.tsx",
  "src/workshop/PhysicsViewport.ts",
];

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name).split("\\").join("/");
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sources(path);
    return /\.(?:tsx?|m?js)$/.test(entry.name) ? [path] : [];
  });
}

it("only shrinks the set of lab shell consumers", () => {
  const consumers = ["src", "tests", "scripts"]
    .flatMap(sources)
    .filter((path) => !SHELL_AND_GUARD.has(path) && SHELL.test(readFileSync(path, "utf8")))
    .sort();
  expect(consumers).toEqual(REMAINING_CONSUMERS);
});

it("recognizes every import form a new consumer could use", () => {
  for (const source of [
    'import { X } from "../scenarios/ScenarioClient.js";',
    'import type { X } from "./ScenarioReplica";',
    'export { X } from "../scenarios/ScenarioPresentationHost.js";',
    'import "../scenarios/ScenarioWorkerHost.js";',
    'const m = await import("../scenarios/ScenarioClient.js");',
    'new Worker(new URL("./scenario.worker.ts", import.meta.url));',
    'import Worker from "./scenario.worker.ts?worker";',
    'vi.mock("./ScenarioClient.js", () => ({}));',
  ])
    expect(SHELL.test(source), source).toBe(true);
  expect(SHELL.test('import { ScenarioSession } from "./ScenarioSession.js";')).toBe(false);
});
