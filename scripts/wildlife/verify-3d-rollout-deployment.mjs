import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { TerrainId } from "../../src/autotile/TerrainId.ts";
import { TILE_SIZE } from "../../src/config/constants.ts";
import { ENTITY_DEFS } from "../../src/entities/EntityDefs.ts";
import { createDescriptor } from "../../src/generation/GenerationDescriptor.ts";
import {
  isCatModelReview,
  isGroundHunterModelReviewCase,
  isRaptorModelReviewCase,
  isWildlifeWorkModelReviewCase,
} from "../../src/scenarios/WildlifeBehaviorModelReview.ts";
import {
  isFarmModelReviewCase,
  isFourStateFaunaModelReview,
  isPackMountModelReview,
  wildlifeFeedingReview,
  wildlifeModelReviewRecipe,
} from "../../src/scenarios/WildlifeModelReviewRecipe.ts";
import { isPondPilotModel } from "../../src/scenarios/WildlifeWaterModelReview.ts";
import { DEER_TYPE } from "../../src/wildlife/Deer.ts";
import { faunaProfile } from "../../src/wildlife/Fauna.ts";
import { forageType } from "../../src/wildlife/ForageResources.ts";
import { MALLARD_TYPE } from "../../src/wildlife/Mallard.ts";
import { predatorProfile } from "../../src/wildlife/Predator.ts";
import {
  WILDLIFE_DEFAULT_MODELS,
  WILDLIFE_MODEL_REVIEW_PREFIX,
  WILDLIFE_MODEL_REVIEWS,
  wildlifeModelClips,
  wildlifeModelReviewPath,
} from "../../src/wildlife/WildlifeModelReviewBank.ts";

const [deployment, batch, reportPath, ...options] = process.argv.slice(2);
assert(
  deployment && batch && reportPath,
  "Usage: verify-3d-rollout-deployment.mjs BASE_URL BATCH REPORT [--review] [--candidate=ID] [--revision=SHA]",
);
const preview = options.includes("--review");
const only = options.find((option) => option.startsWith("--candidate="))?.slice(12);
const revision = options.find((option) => option.startsWith("--revision="))?.slice(11);
const base = new URL(deployment);
const candidates = (preview ? WILDLIFE_MODEL_REVIEWS : WILDLIFE_DEFAULT_MODELS).filter(
  (row) => row.batch === batch && (!only || row.id === only),
);
assert(candidates.length, `No selected wildlife models in ${batch}${only ? ` for ${only}` : ""}`);
const get = (path) => fetch(new URL(path, base), { cache: "no-store" });
const manifestResponse = await get("data/workshop-manifest.json");
assert(manifestResponse.ok);
const manifest = await manifestResponse.json();
if (revision) {
  assert(/^[\da-f]{40}$/.test(revision), "Use the full deployed commit hash");
  const releaseManifest = JSON.parse(
    execFileSync("git", ["show", `${revision}:public/data/workshop-manifest.json`], {
      encoding: "utf8",
      maxBuffer: 3 * 1024 * 1024,
    }),
  );
  assert.equal(manifest.inputDigest, releaseManifest.inputDigest, "Deployment digest differs");
}
const results = [];
const browser = await chromium.launch({ channel: "chromium", args: ["--enable-webgl"] });
try {
  for (const candidate of candidates) {
    const id = WILDLIFE_MODEL_REVIEW_PREFIX + candidate.id;
    const registered = manifest.candidates.find((row) => row.id === id);
    assert(registered?.fingerprint, `${id} missing from the served Workshop manifest`);
    const modelPath = wildlifeModelReviewPath(candidate.id, "model.glb");
    const files = Object.entries(candidate.files).map(([file, sha]) => [
      wildlifeModelReviewPath(candidate.id, file),
      sha,
    ]);
    for (const [file, sha] of files) {
      const response = await get(file);
      assert(response.ok, `Failed to load ${file}: ${response.status}`);
      assert.equal(
        createHash("sha256")
          .update(Buffer.from(await response.arrayBuffer()))
          .digest("hex"),
        sha,
        file,
      );
    }
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const lab = new URL("workshop.html", base);
      lab.searchParams.set("geometry", `nature-${candidate.lab}`);
      lab.searchParams.set("wildlife3dStage", candidate.id);
      lab.hash = "/tool/world-geometry";
      if (preview) lab.searchParams.set("wildlife3dReview", candidate.id);
      const requested = page.waitForResponse(
        (response) => response.url() === new URL(modelPath, base).href,
      );
      await page.goto(lab.href, { waitUntil: "commit" });
      assert((await requested).ok(), `Browser did not load ${modelPath}`);
      const stage = page.getByLabel("Natural landscape playground");
      const modelCount = (enabled) =>
        page.waitForFunction(
          (expected) => {
            const canvas = document.querySelector("[aria-label='Natural landscape playground']");
            return (
              canvas?.dataset.ready === "true" &&
              canvas.dataset.wildlifeReviewModelDrawn === String(expected)
            );
          },
          enabled,
          { timeout: 30_000 },
        );
      await modelCount(true);
      const dogFetch = candidate.lab === "behavior-dog";
      const states = wildlifeModelClips(candidate.type, candidate.classicTravel);
      assert(states?.length, `Missing gameplay clips for ${candidate.type}`);
      const predator = predatorProfile(candidate.type);
      const marineHunter = predator?.expansion?.habitat === "deep";
      const hunterStage = marineHunter || predator?.species === "coconut-crab";
      const fauna = faunaProfile(candidate.type);
      const habitat = fauna?.habitat;
      const waterStage = ["deep", "pond", "shore"].includes(habitat);
      const pondPilot = isPondPilotModel(candidate.type);
      const mallard = candidate.type === MALLARD_TYPE;
      const farmStage = !candidate.classicTravel && isFarmModelReviewCase(candidate.lab);
      const hen = farmStage && candidate.lab === "behavior-chicken";
      const catStage = isCatModelReview(candidate.type, candidate.lab);
      const wildlifeWorkStage = isWildlifeWorkModelReviewCase(candidate.lab);
      const raptorStage = isRaptorModelReviewCase(candidate.lab);
      const groundHunterStage =
        isGroundHunterModelReviewCase(candidate.lab) || predator?.species === "coconut-crab";
      const secretaryStage = candidate.lab === "secretary-bird";
      const pilotForage =
        candidate.id === "rabbit-pilot-v1"
          ? { type: forageType("greens"), dx: 40, dy: 12 }
          : candidate.id === "robin-pilot-v1"
            ? { type: forageType("seed"), dx: 40, dy: 12 }
            : undefined;
      const waterAnimal = waterStage ? fauna : undefined;
      const pondAnimal = marineHunter ? predator : waterAnimal;
      const pond = pondAnimal
        ? {
            water:
              habitat === "deep" || marineHunter ? TerrainId.DeepWater : TerrainId.ShallowWater,
            shore: habitat === "shore",
            halfWidth: pondAnimal.body[0] / 2,
            radius: Math.max(
              6,
              Math.ceil((predator?.expansion?.radius ?? waterAnimal?.radius ?? 96) / TILE_SIZE),
            ),
            alarm: marineHunter ? 18 : waterAnimal.alarmDistance,
          }
        : pondPilot
          ? { water: TerrainId.ShallowWater, shore: true, halfWidth: 5, radius: 6, alarm: 20 }
          : undefined;
      const fourStateStage = isFourStateFaunaModelReview(candidate.type, candidate.lab);
      const packStage = isPackMountModelReview(candidate.type, candidate.lab);
      const feeding = wildlifeFeedingReview(candidate.type, candidate.lab);
      const doeStage = candidate.type === DEER_TYPE;
      const observeAllStates =
        candidate.classicTravel ||
        hunterStage ||
        waterStage ||
        pondPilot ||
        farmStage ||
        catStage ||
        wildlifeWorkStage ||
        raptorStage ||
        groundHunterStage ||
        fourStateStage ||
        packStage ||
        feeding ||
        candidate.type === "wildlife-robin-v1";
      const contactClips = mallard
        ? ["flight"]
        : secretaryStage || groundHunterStage
          ? ["display"]
          : wildlifeWorkStage
            ? ["action", "flee"]
            : hunterStage
              ? ["display"]
              : waterStage
                ? ["flee", "flee-swim"]
                : farmStage || packStage
                  ? ["flee", "ride", "ride-sprint"]
                  : doeStage
                    ? ["stamp", "flee"]
                    : fourStateStage || catStage || feeding
                      ? ["flee"]
                      : [];
      const naturalClips = observeAllStates
        ? states.flatMap(({ name }, index) =>
            contactClips.includes(name) || (catStage && name === "action") ? [] : [index],
          )
        : [];
      if (dogFetch)
        await page
          .getByRole("button", { name: "Throw ball for dog", exact: true })
          .dispatchEvent("click");
      const poses = await stage.evaluate(
        (canvas, species) =>
          new Promise((resolve) => {
            const clips = new Set();
            let minZ = Infinity;
            let maxZ = -Infinity;
            let carriedItem = false;
            const finish = () => {
              observer.disconnect();
              clearTimeout(deadline);
              resolve({ clips: [...clips].sort((a, b) => a - b), minZ, maxZ, carriedItem });
            };
            function sample() {
              if (canvas.dataset.wildlifeReviewModelDrawn !== "true") return;
              const key =
                (species.classic ? "classicWildlifePoses" : undefined) ??
                {
                  rabbit: "rabbitPoses",
                  robin: "robinPoses",
                  deer: "deerPoses",
                  frog: "frogPoses",
                  mallard: "wildlifePoses",
                }[species.name] ??
                (species.predator ? "predatorPoses" : "faunaPoses");
              for (const body of JSON.parse(canvas.dataset[key] ?? "[]")) {
                if (key === "faunaPoses" && body.species !== species.name) continue;
                if ((key === "predatorPoses" || species.classic) && body.type !== species.type)
                  continue;
                if (Number.isInteger(body.clip) && (!species.feeding || body.state !== "scared"))
                  clips.add(body.clip);
                minZ = Math.min(minZ, body.z);
                maxZ = Math.max(maxZ, body.z);
              }
              if (species.fetch)
                carriedItem ||= JSON.parse(canvas.dataset.workActors ?? "[]").some(
                  ({ type, parent }) => type === "ball" && parent >= 0,
                );
              if (
                species.naturalClips.length &&
                species.naturalClips.every((clip) => clips.has(clip))
              )
                finish();
            }
            const observer = new MutationObserver(sample);
            const deadline = setTimeout(finish, species.timeout);
            observer.observe(canvas, { attributes: true });
            sample();
          }),
        {
          type: candidate.type,
          name: candidate.type
            .replace(/^wildlife-/, "")
            .replace(/-(?:provisional-|predator-)?v\d+$/, ""),
          predator: candidate.type.includes("-predator-"),
          classic: !!candidate.classicTravel,
          fetch: dogFetch,
          feeding: !!feeding,
          naturalClips,
          timeout:
            raptorStage || groundHunterStage || pondPilot
              ? 130_000
              : catStage || wildlifeWorkStage
                ? 100_000
                : feeding || farmStage
                  ? 58_000
                  : naturalClips.length
                    ? 36_000
                    : dogFetch
                      ? 30_000
                      : 14_000,
        },
      );
      const switchModels = page.getByRole("checkbox", { name: "3D animals", exact: true });
      const approachStates = doeStage
        ? await verifyDoeApproach(page, candidate, states)
        : catStage || wildlifeWorkStage
          ? await verifyStartleInFreshStage(page, stage, candidate, states)
          : (farmStage && !hen) || fourStateStage || packStage || feeding
            ? await verifyApproachClips(page, stage, candidate, states)
            : [];
      const landingStates =
        (farmStage && !hen) ||
        fourStateStage ||
        catStage ||
        wildlifeWorkStage ||
        (raptorStage && !secretaryStage) ||
        packStage ||
        feeding
          ? []
          : await verifyLandingClips(page, candidate, states);
      for (const clip of [...landingStates, ...approachStates])
        if (!poses.clips.includes(clip)) poses.clips.push(clip);
      if (observeAllStates) {
        const missing = states.filter((_, clip) => !poses.clips.includes(clip));
        assert.equal(
          missing.length,
          0,
          `${candidate.type} missing gameplay clips: ${missing.map(({ name }) => name).join(", ")}`,
        );
      }
      assert(await switchModels.isChecked());
      await switchModels.uncheck();
      await modelCount(false);
      await switchModels.check();
      await modelCount(true);
      assert(poses.clips.length > 1, `No gameplay clip transition observed for ${candidate.type}`);
      if (fourStateStage && faunaProfile(candidate.type)?.hop)
        assert(poses.maxZ > 2, `No physical hop observed for ${candidate.type}`);
      const game = await verifyGameEntry(page, candidate, preview, {
        verifyFaunaStates:
          fourStateStage ||
          packStage ||
          farmStage ||
          wildlifeWorkStage ||
          raptorStage ||
          groundHunterStage ||
          !!feeding ||
          !!pilotForage ||
          !!pond,
        catStage,
        dogFetch,
        useStick: secretaryStage || groundHunterStage || marineHunter || mallard || hen,
        workPlacements: pilotForage
          ? [
              pilotForage,
              ...(candidate.id === "robin-pilot-v1"
                ? [{ type: "prop-oak-tree", dx: 0, dy: -64 }]
                : []),
            ]
          : wildlifeWorkStage || raptorStage || groundHunterStage || marineHunter || farmStage
            ? reviewActorPlacements(candidate)
            : [],
        pond,
        packStage: packStage || (farmStage && !!fauna?.rideSpeed),
        farmStage,
        approachClips: contactClips,
        states,
        feeding,
      });
      assert.deepEqual(errors, []);
      results.push({
        type: candidate.type,
        mode: preview ? "review link" : "default",
        manifestFingerprint: registered.fingerprint,
        modelSha256: candidate.files["model.glb"],
        lab: lab.href,
        statesObserved: poses.clips
          .sort((a, b) => a - b)
          .map((index) => states?.[index]?.name ?? index),
        heightRange: [poses.minZ, poses.maxZ],
        ...(dogFetch ? { carriedItemObserved: poses.carriedItem } : {}),
        ...(landingStates.length
          ? { statesOnLanding: landingStates.map((clip) => states[clip].name) }
          : {}),
        ...(approachStates.length
          ? { statesOnApproachOrMount: approachStates.map((clip) => states[clip].name) }
          : {}),
        spritePreferenceRoundTrip: true,
        game,
      });
    } finally {
      await context.close();
    }
    console.log(`Verified served evidence and shared Workshop play for ${candidate.name}.`);
  }
  if (revision) {
    const current = await get("data/workshop-manifest.json");
    assert(current.ok, "Could not confirm the deployed revision after playback");
    assert.equal(
      (await current.json()).inputDigest,
      manifest.inputDigest,
      "Deployment changed during playback",
    );
  }
  await writeFile(
    reportPath,
    `${JSON.stringify(
      {
        deployment: base.href,
        ...(revision ? { revision } : {}),
        workshopInputDigest: manifest.inputDigest,
        results,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await browser.close();
}

async function verifyStartleInFreshStage(page, stage, candidate, states) {
  await page.getByRole("button", { name: "Reset scene", exact: true }).click();
  const species = faunaProfile(candidate.type).species;
  const { wx, wy } = wildlifeModelReviewRecipe(candidate.type, candidate.lab).actors[0].position;
  const approach = page.getByRole("button", { name: `Start near ${candidate.name}`, exact: true });
  await stage.waitFor();
  await page.waitForFunction(
    ({ name, wx, wy }) => {
      const canvas = document.querySelector("[aria-label='Natural landscape playground']");
      return (
        canvas?.dataset.ready === "true" &&
        JSON.parse(canvas.dataset.faunaPoses ?? "[]").some(
          (pose) => pose.species === name && Math.abs(pose.x - wx) < 2 && Math.abs(pose.y - wy) < 2,
        )
      );
    },
    { name: species, wx, wy },
    { timeout: 15_000 },
  );
  const action = states.findIndex(({ name }) => name === "action");
  const flee = states.findIndex(({ name }) => name === "flee");
  await approach.click();
  await Promise.all(
    [action, flee].map((clip) =>
      waitForAnimalClip(page, { species, clip, dataset: "faunaPoses", state: "scared" }, 10_000),
    ),
  );
  return [action, flee];
}

function reviewActorPlacements(candidate) {
  const recipe = wildlifeModelReviewRecipe(candidate.type, candidate.lab);
  const [bird, ...related] = recipe.actors;
  const companions = related.map((actor) => ({ type: actor.type, ...actor.position }));
  return [...(recipe.nativeProps ?? []), ...companions].map(({ type, wx, wy }) => ({
    type,
    dx: wx - bird.position.wx,
    dy: wy - bird.position.wy,
  }));
}

async function verifyApproachClips(page, stage, candidate, states) {
  const profile = faunaProfile(candidate.type);
  const clipIndex = (name) => states.findIndex((state) => state.name === name);
  const approach = page.getByRole("button", { name: `Start near ${candidate.name}`, exact: true });
  await waitForAnimalOnGround(page, profile.species);
  const flee = await landAndObserve(
    page,
    approach,
    clipIndex("flee"),
    "faunaPoses",
    profile.species,
  );
  if (!profile.rideSpeed) return [flee];

  const mount = page.getByRole("button", { name: `Hop onto ${candidate.name}`, exact: true });
  const ridden = { species: profile.species, dataset: "faunaPoses", state: "ridden" };
  await waitForAnimalOnGround(page, profile.species);
  await mount.dispatchEvent("click");
  await waitForAnimalClip(page, { ...ridden, clip: clipIndex("idle") }, 12_000);
  await stage.focus();
  await page.keyboard.down("d");
  try {
    await waitForAnimalClip(page, { ...ridden, clip: clipIndex("ride") }, 3000);
    await page.keyboard.down("ShiftLeft");
    try {
      await waitForAnimalClip(page, { ...ridden, clip: clipIndex("ride-sprint") }, 3000);
    } finally {
      await page.keyboard.up("ShiftLeft");
    }
  } finally {
    await page.keyboard.up("d");
  }
  return [flee, clipIndex("ride"), clipIndex("ride-sprint")];
}

async function verifyDoeApproach(page, candidate, states) {
  const match = (name) => states.findIndex((state) => state.name === name);
  const button = page.getByRole("button", { name: `Start near ${candidate.name}`, exact: true });
  const stamp = await landAndObserve(page, button, match("stamp"), "deerPoses", candidate.type);
  const flee = match("flee");
  await waitForAnimalClip(
    page,
    { species: candidate.type, clip: flee, dataset: "deerPoses", state: "scared" },
    12_000,
  );
  return [stamp, flee];
}

async function waitForAnimalOnGround(page, species) {
  await page.waitForFunction(
    (species) => {
      const canvas = document.querySelector("[aria-label='Natural landscape playground']");
      return JSON.parse(canvas?.dataset.faunaPoses ?? "[]").some(
        (pose) => pose.species === species && pose.state !== "scared" && pose.z < 0.5,
      );
    },
    species,
    { timeout: 12_000 },
  );
}

async function verifyLandingClips(page, candidate, states) {
  if (candidate.type === MALLARD_TYPE) {
    const button = page.getByRole("button", { name: `Hop onto ${candidate.name}`, exact: true });
    if (!(await button.count())) return [];
    const clip = states.findIndex((state) => state.name === "flight");
    return [await landAndObserve(page, button, clip, "wildlifePoses")];
  }
  if (candidate.type.includes("-predator-")) {
    const button = page.getByRole("button", { name: `Hop onto ${candidate.name}`, exact: true });
    if (!(await button.count())) return [];
    const clip = states.findIndex((state) => state.name === "display");
    return [await landAndObserve(page, button, clip, "predatorPoses", candidate.type)];
  }
  const profile = faunaProfile(candidate.type);
  if (profile && profile.habitat !== "shore") {
    const clip = states.findIndex((state) => state.name === "flee");
    if (clip < 0) return [];
    const button = page.getByRole("button", { name: `Hop onto ${profile.label}`, exact: true });
    if (!(await button.count())) return [];
    return [await landAndObserve(page, button, clip, "faunaPoses", profile.species)];
  }
  if (profile?.habitat !== "shore") return [];
  const results = [];
  for (const [suffix, state] of [
    ["ashore", "flee"],
    ["in water", "flee-swim"],
  ]) {
    const button = page.getByRole("button", {
      name: `Hop onto ${candidate.name} ${suffix}`,
      exact: true,
    });
    const clip = states.findIndex((entry) => entry.name === state);
    results.push(await landAndObserve(page, button, clip, "faunaPoses", profile.species));
  }
  return results;
}

async function landAndObserve(page, button, clip, dataset, species) {
  assert(clip >= 0, `Missing landing response for ${species}`);
  for (let attempt = 0; attempt < 3; attempt++) {
    await button.dispatchEvent("click");
    try {
      await waitForAnimalClip(page, { species, clip, dataset, state: "scared" }, 4500);
      return clip;
    } catch (error) {
      if (error.name !== "TimeoutError" || attempt === 2) throw error;
    }
  }
  throw Error(`No landing response for ${species}`);
}

async function waitForAnimalClip(page, expected, timeout) {
  await page.waitForFunction(
    ({ species, clip, dataset, state }) => {
      const canvas = document.querySelector("[aria-label='Natural landscape playground']");
      return (
        canvas?.dataset.wildlifeReviewModelDrawn === "true" &&
        JSON.parse(canvas.dataset[dataset] ?? "[]").some(
          (pose) =>
            (pose.type ?? pose.species) === species &&
            pose.clip === clip &&
            pose.state === state &&
            (state !== "ridden" || Number(canvas.dataset.playerParent) === pose.id),
        )
      );
    },
    expected,
    { timeout },
  );
}

async function verifyGameEntry(page, candidate, preview, options) {
  const {
    verifyFaunaStates,
    catStage,
    dogFetch,
    useStick,
    workPlacements,
    packStage,
    farmStage,
    approachClips,
    states,
    feeding,
    pond,
  } = options;
  await page.evaluate(() => localStorage.removeItem("tilefun-3d-animals"));
  const generation = createDescriptor("flat", 1);
  const arrival = { x: 4, y: 4, generation };
  const gameUrl = new URL(base);
  gameUrl.searchParams.set("nogamepad", "");
  gameUrl.searchParams.set("generation", JSON.stringify(generation));
  gameUrl.searchParams.set("arrival", JSON.stringify(arrival));
  if (preview) gameUrl.searchParams.set("wildlife3dReview", candidate.id);
  await page.goto(gameUrl.href, { waitUntil: "commit" });
  await page.getByRole("button", { name: "New World", exact: true }).click({ timeout: 45_000 });
  await gameReady(page);
  const pondShore = await page.evaluate(
    ({ type, distantPlacement, catStage, workPlacements, feeding, pond, tileSize }) => {
      const game = document.querySelector("#game").__game;
      const position = game.stateView.playerEntity.position;
      game.transport.send({ type: "set-editor-mode", enabled: true });
      let wx = position.wx + (pond ? 166 : distantPlacement ? 116 : 20);
      const wy = position.wy + 28;
      let pondShore;
      if (pond) {
        const centerX = Math.floor(wx / tileSize);
        const centerY = Math.floor(wy / tileSize);
        if (pond.halfWidth > 6) wx = Math.max(wx, centerX * tileSize + pond.halfWidth + 4);
        pondShore = {
          wx: centerX * tileSize + 4,
          wy: (centerY + 0.5) * tileSize,
          wz: 0,
          alarm: pond.alarm,
          shore: pond.shore,
        };
        for (let ty = centerY - pond.radius; ty <= centerY + pond.radius; ty++) {
          for (let tx = centerX - 6; tx <= centerX + pond.radius; tx++) {
            // Leave a bank the player can walk along while the fish swims away.
            if (tx < centerX && Math.abs(ty - centerY) <= 1) continue;
            game.transport.send({
              type: "edit-terrain-tile",
              tx,
              ty,
              terrainId: pond.water,
              paintMode: "positive",
              bridgeDepth: 0,
            });
          }
        }
        if (pond.shore)
          game.transport.send({
            type: "edit-spawn",
            entityType: type,
            wx: centerX * tileSize - 49,
            wy: pondShore.wy,
          });
      }
      game.transport.send({ type: "edit-spawn", entityType: type, wx, wy });
      for (const placement of workPlacements)
        game.transport.send({
          type: "edit-spawn",
          entityType: placement.type,
          wx: wx + placement.dx,
          wy: wy + placement.dy,
        });
      if (catStage)
        game.transport.send({ type: "edit-spawn", entityType: "prop-oak-tree", wx, wy: wy - 57 });
      if (feeding) {
        const site = { wx: wx + feeding.dx, wy: wy + feeding.dy };
        if (feeding.prop)
          game.transport.send({ type: "edit-spawn", entityType: feeding.prop, ...site });
        game.transport.send({ type: "edit-spawn", entityType: feeding.resource, ...site });
      }
      game.transport.send({ type: "set-editor-mode", enabled: false });
      return pondShore;
    },
    {
      type: candidate.type,
      distantPlacement: verifyFaunaStates || catStage || dogFetch,
      catStage,
      workPlacements,
      feeding,
      pond,
      tileSize: TILE_SIZE,
    },
  );
  const expected = { type: candidate.type, sheetKey: ENTITY_DEFS[candidate.type].sprite.sheetKey };
  const animal = ({ type, sheetKey }) => {
    const game = document.querySelector("#game")?.__game;
    return (
      game?.stateView.entities.some((entry) => entry.type === type) &&
      game.firstPerson.wildlifeModelDrawn(sheetKey)
    );
  };
  await page.waitForFunction(animal, expected, { timeout: 30_000 });
  await page.evaluate(async () => {
    const game = document.querySelector("#game").__game;
    game.loop.stop();
    const worker = game.netEmulatedTransport.base;
    worker.setHidden(true);
    await worker.flush();
    await worker.shutdown();
  });
  gameUrl.searchParams.delete("generation");
  gameUrl.searchParams.delete("arrival");
  await page.goto(gameUrl.href, { waitUntil: "commit" });
  await gameReady(page);
  await page.waitForFunction(animal, expected, { timeout: 30_000 });
  const result = { createdAndDrawn: true, savedAndDrawnAfterReload: true };
  if (catStage || dogFetch)
    return {
      ...result,
      statesAfterReload: await verifyPetToyInGame(
        page,
        expected,
        states,
        catStage ? "stalk" : "pickup",
      ),
    };
  if (verifyFaunaStates) {
    const rideClips = packStage ? ["ride", "ride-sprint"] : [];
    const statesAfterReload = await verifyActorStatesInGame(
      page,
      expected,
      states,
      approachClips,
      rideClips,
      !!feeding || farmStage,
      useStick,
      pondShore,
    );
    if (packStage) statesAfterReload.push(...(await verifyPackMountInGame(page, expected, states)));
    return {
      ...result,
      statesAfterReload,
    };
  }
  if (!candidate.classicTravel) return result;
  const statesAfterReload = await page.evaluate(
    async ({ type, sheetKey, travel }) => {
      const game = document.querySelector("#game").__game;
      const states = new Set();
      const end = performance.now() + 12_000;
      do {
        const sprite = game.stateView.entities.find((entry) => entry.type === type)?.sprite;
        if (sprite && game.firstPerson.wildlifeModelDrawn(sheetKey))
          states.add(sprite.moving ? travel : "idle");
        if (states.size === 2) break;
        await new Promise(requestAnimationFrame);
      } while (performance.now() < end);
      return [...states];
    },
    { ...expected, travel: candidate.classicTravel },
  );
  assert.deepEqual(
    statesAfterReload.sort(),
    ["idle", candidate.classicTravel].sort(),
    `Reopened game did not render both classic states for ${candidate.type}`,
  );
  return { ...result, statesAfterReload };
}

async function selectTool(page, name) {
  const tool = page.getByRole("button", { name, exact: true });
  if ((await tool.getAttribute("aria-pressed")) !== "true") await tool.click();
}

async function verifyPetToyInGame(page, expected, clips, firstToyState) {
  await selectTool(page, "Ball");
  const states = await page.evaluate(
    async ({ type, sheetKey, names, returnDistance, firstToyState }) => {
      const game = document.querySelector("#game").__game;
      game.playInput.setMovementMode("tap");
      const origin = { ...game.stateView.playerEntity.position, wz: 0 };
      const observed = new Set();
      let nextTarget = 0;
      let thrownAt;
      let returned = false;
      let previousState;
      let bats = 0;
      let lastBatAt = 0;
      const end = performance.now() + 120_000;
      try {
        while (performance.now() < end) {
          const actor = game.stateView.entities.find((entry) => entry.type === type);
          const player = game.stateView.playerEntity;
          if (actor?.sprite && game.firstPerson.wildlifeModelDrawn(sheetKey)) {
            const name = names[actor.sprite.clip ?? 0];
            if (name !== "action" || actor.wanderAI?.state !== "scared") observed.add(name);
            if (observed.size === names.length) break;
            const now = performance.now();
            if (name === "bat" && previousState !== "bat") {
              bats++;
              lastBatAt = now;
            }
            previousState = name;
            const needsAnotherToy =
              firstToyState === "stalk" && bats < 3 && now - lastBatAt > 12_000;
            if (!observed.has("flee")) {
              if (
                now >= nextTarget &&
                ["idle", "walk", "action"].every((clip) => observed.has(clip))
              ) {
                game.tapMovement.setTarget({ ...actor.position, wz: 0 });
                nextTarget = now + 350;
              }
            } else if (!returned) {
              game.tapMovement.setTarget(origin);
              returned = true;
            } else if (
              thrownAt === undefined ||
              ((!observed.has(firstToyState) || needsAnotherToy) && now - thrownAt > 10_000)
            ) {
              const ox = origin.wx - player.position.wx;
              const oy = origin.wy - player.position.wy;
              if (Math.hypot(ox, oy) < returnDistance) {
                const dx = actor.position.wx - player.position.wx;
                const dy = actor.position.wy - player.position.wy;
                const distance = Math.hypot(dx, dy);
                game.transport.send({
                  type: "use-item",
                  dirX: dx / distance,
                  dirY: dy / distance,
                  force: 0,
                });
                thrownAt = now;
              }
            }
          }
          await new Promise(requestAnimationFrame);
        }
      } finally {
        game.tapMovement.cancel();
      }
      return [...observed];
    },
    {
      ...expected,
      names: clips.map(({ name }) => name),
      returnDistance: TILE_SIZE / 2 + 1,
      firstToyState,
    },
  );
  assert.deepEqual(
    states.sort(),
    clips.map(({ name }) => name).sort(),
    `Reopened pet states for ${expected.type}`,
  );
  return states;
}

async function verifyActorStatesInGame(
  page,
  expected,
  clips,
  approachClips,
  rideClips,
  feeding,
  useStick,
  pondShore,
) {
  if (useStick) await selectTool(page, "Stick");
  const passive = clips.flatMap(({ name }, index) => (approachClips.includes(name) ? [] : [index]));
  const action = approachClips.includes("action")
    ? -1
    : clips.findIndex(({ name }) => name === "action");
  const groundFlee = clips.findIndex(({ name }) => name === "flee");
  const waterFlee = clips.findIndex(({ name }) => name === "flee-swim");
  const states = await page.evaluate(
    async ({
      type,
      sheetKey,
      passive,
      action,
      total,
      timeout,
      clearForageType,
      useStick,
      pondShore,
      groundFlee,
      waterFlee,
    }) => {
      const game = document.querySelector("#game").__game;
      game.playInput.setMovementMode("tap");
      const observed = new Set();
      let nextTarget = 0;
      let clearedForage = false;
      let nextJump = 0;
      let aimAcrossWaterUntil = 0;
      let nearest = Infinity;
      const approachStates = new Set();
      const end = performance.now() + timeout;
      try {
        while (performance.now() < end) {
          const actors = game.stateView.entities.filter(
            (entry) => entry.type === type && entry.sprite,
          );
          if (actors.length && game.firstPerson.wildlifeModelDrawn(sheetKey)) {
            for (const actor of actors) {
              const { clip = 0 } = actor.sprite;
              if (clip !== action || actor.wanderAI?.state !== "scared") observed.add(clip);
            }
            if (observed.size === total) break;
            // Wait for the animal's voluntary action before approaching it.
            if (passive.every((index) => observed.has(index))) {
              const inWater = !pondShore?.shore || observed.has(groundFlee);
              const actor = pondShore?.shore
                ? actors.find((entry) => !!entry.noShadow === inWater)
                : actors[0];
              if (!actor || (pondShore?.shore && inWater && observed.has(waterFlee))) {
                await new Promise(requestAnimationFrame);
                continue;
              }
              const playerBody = game.stateView.playerEntity;
              const player = playerBody.position;
              const dx = actor.position.wx - player.wx;
              const dy = actor.position.wy - player.wy;
              const distance = Math.hypot(dx, dy);
              nearest = Math.min(nearest, distance);
              approachStates.add(actor.wanderAI?.state);
              if (clearForageType && !clearedForage) {
                for (const item of game.stateView.entities)
                  if (item.type === clearForageType && item.parentId === undefined)
                    game.transport.send({ type: "edit-delete-entity", entityId: item.id });
                // The crow can remain above the escape path on its nest support.
                for (const prop of game.stateView.props)
                  if (prop.type === "prop-oak-tree")
                    game.transport.send({ type: "edit-delete-prop", propId: prop.id });
                clearedForage = true;
              }
              if (actor.wanderAI?.state === "scared") game.tapMovement.cancel();
              else if (
                performance.now() >= nextTarget &&
                (!clearForageType || (actor.wz ?? 0) < 1)
              ) {
                const now = performance.now();
                if (
                  pondShore &&
                  inWater &&
                  distance > pondShore.alarm &&
                  Math.hypot(player.wx - pondShore.wx, player.wy - pondShore.wy) < 19 &&
                  (playerBody.wz ?? 0) < 0.5 &&
                  now >= nextJump
                ) {
                  const input = (type, key, code) =>
                    window.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true }));
                  input("keydown", "Shift", "ShiftLeft");
                  input("keydown", " ", "Space");
                  setTimeout(() => input("keyup", " ", "Space"), 180);
                  setTimeout(() => input("keyup", "Shift", "ShiftLeft"), 620);
                  aimAcrossWaterUntil = now + 780;
                  nextJump = now + 1450;
                }
                game.tapMovement.setTarget(
                  pondShore && inWater && now >= aimAcrossWaterUntil
                    ? pondShore
                    : { ...actor.position, wz: 0 },
                );
                if (useStick && distance > 0 && distance < 24)
                  game.transport.send({
                    type: "use-item",
                    dirX: dx / distance,
                    dirY: dy / distance,
                    force: 0,
                  });
                nextTarget = performance.now() + 350;
              }
            }
          }
          await new Promise(requestAnimationFrame);
        }
      } finally {
        game.tapMovement.cancel();
      }
      return {
        observed: [...observed].sort((a, b) => a - b),
        nearest,
        approachStates: [...approachStates],
      };
    },
    {
      ...expected,
      passive,
      action,
      total: clips.length - rideClips.length,
      timeout: expected.type.includes("-predator-")
        ? 130_000
        : feeding || pondShore || approachClips.includes("action")
          ? 65_000
          : 38_000,
      useStick,
      pondShore,
      groundFlee,
      waterFlee,
      clearForageType:
        faunaProfile(expected.type)?.species === "crow" ? forageType("twig") : undefined,
    },
  );
  assert.deepEqual(
    states.observed,
    clips.flatMap(({ name }, index) => (rideClips.includes(name) ? [] : [index])),
    `Reopened game states for ${expected.type}: ${states.observed.map((clip) => clips[clip]?.name).join(", ")} (nearest approach ${states.nearest}px, ${states.approachStates.join(", ")})`,
  );
  return states.observed.map((clip) => clips[clip].name);
}

async function verifyPackMountInGame(page, expected, clips) {
  const original = await page.evaluate(({ type }) => {
    const game = document.querySelector("#game").__game;
    const player = game.stateView.playerEntity.position;
    const ids = game.stateView.entities.filter((actor) => actor.type === type).map(({ id }) => id);
    game.debugPanel.setPaused(true);
    game.transport.send({ type: "set-debug", paused: true });
    game.transport.send({ type: "set-editor-mode", enabled: true });
    game.transport.send({
      type: "edit-spawn",
      entityType: type,
      wx: player.wx + 22,
      wy: player.wy,
    });
    game.transport.send({ type: "set-editor-mode", enabled: false });
    return ids;
  }, expected);
  await page.waitForFunction(
    ({ type, original }) => {
      const game = document.querySelector("#game").__game;
      return (
        !game.stateView.editorEnabled &&
        game.stateView.entities.some((actor) => actor.type === type && !original.includes(actor.id))
      );
    },
    { ...expected, original },
    { timeout: 12_000 },
  );
  const waitForRidingClip = (name) =>
    page.waitForFunction(
      ({ type, sheetKey, original, index }) => {
        const game = document.querySelector("#game").__game;
        const rider = game.stateView.playerEntity;
        return (
          game.firstPerson.wildlifeModelDrawn(sheetKey) &&
          game.stateView.entities.some(
            (actor) =>
              actor.type === type &&
              !original.includes(actor.id) &&
              actor.id === rider?.parentId &&
              actor.wanderAI?.state === "ridden" &&
              actor.sprite?.clip === index,
          )
        );
      },
      { ...expected, original, index: clips.findIndex(({ name: clip }) => clip === name) },
      { timeout: 12_000 },
    );
  await page.evaluate(() => {
    const game = document.querySelector("#game").__game;
    game.debugPanel.setPaused(false);
    game.transport.send({ type: "set-debug", paused: false });
    for (const [key, code] of [
      [" ", "Space"],
      ["d", "KeyD"],
    ])
      window.dispatchEvent(new KeyboardEvent("keydown", { key, code, bubbles: true }));
  });
  try {
    await waitForRidingClip("ride");
    await page.keyboard.up("Space");
    await page.keyboard.down("ShiftLeft");
    await waitForRidingClip("ride-sprint");
  } catch (error) {
    const pose = await page.evaluate(
      ({ type, original }) => {
        const { stateView } = document.querySelector("#game").__game;
        const player = stateView.playerEntity;
        const mount = stateView.entities.find(
          (actor) => actor.type === type && !original.includes(actor.id),
        );
        return {
          player: { ...player.position, parent: player.parentId, wz: player.wz },
          mount: mount && {
            ...mount.position,
            id: mount.id,
            state: mount.wanderAI?.state,
            clip: mount.sprite?.clip,
          },
        };
      },
      { ...expected, original },
    );
    throw Error(`Normal-game mount check for ${expected.type} ended at ${JSON.stringify(pose)}`, {
      cause: error,
    });
  } finally {
    await page.keyboard.up("ShiftLeft");
    await page.keyboard.up("Space");
    await page.keyboard.up("KeyD");
  }
  return ["ride", "ride-sprint"];
}

async function gameReady(page) {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector("#game");
      return (
        canvas?.dataset.ready === "true" &&
        !canvas.__game.mainMenu.visible &&
        !!canvas.__game.stateView.playerEntity
      );
    },
    undefined,
    { timeout: 45_000 },
  );
}
