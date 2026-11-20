import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { ENTITY_DEFS } from "../../src/entities/EntityDefs.ts";
import { createDescriptor } from "../../src/generation/GenerationDescriptor.ts";
import {
  isFarmModelReviewCase,
  isGroundFaunaModelReview,
  isPackMountModelReview,
  wildlifeFeedingReview,
} from "../../src/scenarios/WildlifeModelReviewRecipe.ts";
import { DEER_TYPE } from "../../src/wildlife/Deer.ts";
import { faunaProfile } from "../../src/wildlife/Fauna.ts";
import { predatorProfile } from "../../src/wildlife/Predator.ts";
import {
  PROMOTED_WILDLIFE_MODELS,
  WILDLIFE_MODEL_REVIEW_PREFIX,
  WILDLIFE_MODEL_REVIEWS,
  wildlifeModelClips,
  wildlifeModelReviewPath,
  wildlifeModelRuntimePath,
} from "../../src/wildlife/WildlifeModelReviewBank.ts";

const [deployment, batch, reportPath] = process.argv.slice(2);
assert(
  deployment && batch && reportPath,
  "Usage: verify-3d-rollout-deployment.mjs BASE_URL BATCH REPORT",
);
const base = new URL(deployment);
const candidates = WILDLIFE_MODEL_REVIEWS.filter((row) => row.batch === batch);
assert(candidates.length, `Unknown wildlife batch ${batch}`);
const get = (path) => fetch(new URL(path, base), { cache: "no-store" });
const manifestResponse = await get("data/workshop-manifest.json");
assert(manifestResponse.ok);
const manifest = await manifestResponse.json();
const results = [];
const browser = await chromium.launch({ channel: "chromium", args: ["--enable-webgl"] });
try {
  for (const candidate of candidates) {
    const id = WILDLIFE_MODEL_REVIEW_PREFIX + candidate.id;
    const registered = manifest.candidates.find((row) => row.id === id);
    assert(registered?.fingerprint, `${id} missing from the served Workshop manifest`);
    const promoted = PROMOTED_WILDLIFE_MODELS[candidate.type] === candidate.id;
    const modelPath = promoted
      ? wildlifeModelRuntimePath(candidate.id)
      : wildlifeModelReviewPath(candidate.id, "model.glb");
    const files = Object.entries(candidate.files).map(([file, sha]) => [
      wildlifeModelReviewPath(candidate.id, file),
      sha,
    ]);
    if (promoted) files.push([modelPath, candidate.files["model.glb"]]);
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
      if (!promoted) lab.searchParams.set("wildlife3dReview", candidate.id);
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
      const hunterStage =
        predator?.expansion?.habitat === "deep" || predator?.species === "coconut-crab";
      const habitat = faunaProfile(candidate.type)?.habitat;
      const waterStage = ["deep", "pond", "shore"].includes(habitat);
      const farmStage = !candidate.classicTravel && isFarmModelReviewCase(candidate.lab);
      const groundStage = isGroundFaunaModelReview(candidate.type, candidate.lab);
      const packStage = isPackMountModelReview(candidate.type, candidate.lab);
      const feeding = wildlifeFeedingReview(candidate.type, candidate.lab);
      const doeStage = candidate.type === DEER_TYPE;
      const observeAllStates =
        candidate.classicTravel ||
        hunterStage ||
        waterStage ||
        farmStage ||
        groundStage ||
        packStage ||
        feeding ||
        candidate.type === "wildlife-robin-v1";
      const contactClips = hunterStage
        ? ["display"]
        : waterStage
          ? ["flee", "flee-swim"]
          : farmStage || packStage
            ? ["flee", "ride", "ride-sprint"]
            : doeStage
              ? ["stamp", "flee"]
              : groundStage || feeding
                ? ["flee"]
                : [];
      const naturalClips = observeAllStates
        ? states.flatMap(({ name }, index) => (contactClips.includes(name) ? [] : [index]))
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
            feeding || farmStage
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
        : farmStage || groundStage || packStage || feeding
          ? await verifyApproachClips(page, stage, candidate, states)
          : [];
      const landingStates =
        farmStage || groundStage || packStage || feeding
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
      if (groundStage && faunaProfile(candidate.type)?.hop)
        assert(poses.maxZ > 2, `No physical hop observed for ${candidate.type}`);
      const game = await verifyGameEntry(page, candidate, promoted, {
        verifyGroundStates: groundStage || packStage || !!feeding,
        packStage,
        approachClips: contactClips,
        states,
        feeding,
      });
      assert.deepEqual(errors, []);
      results.push({
        type: candidate.type,
        mode: promoted ? "default" : "review link",
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
  await writeFile(
    reportPath,
    `${JSON.stringify(
      {
        deployment: base.href,
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

async function verifyGameEntry(page, candidate, promoted, options) {
  const { verifyGroundStates, packStage, approachClips, states, feeding } = options;
  await page.evaluate(() => localStorage.removeItem("tilefun-3d-animals"));
  const generation = createDescriptor("flat", 1);
  const arrival = { x: 4, y: 4, generation };
  const gameUrl = new URL(base);
  gameUrl.searchParams.set("nogamepad", "");
  gameUrl.searchParams.set("generation", JSON.stringify(generation));
  gameUrl.searchParams.set("arrival", JSON.stringify(arrival));
  if (!promoted) gameUrl.searchParams.set("wildlife3dReview", candidate.id);
  await page.goto(gameUrl.href, { waitUntil: "commit" });
  await page.getByRole("button", { name: "New World", exact: true }).click({ timeout: 45_000 });
  await gameReady(page);
  await page.evaluate(
    ({ type, verifyGroundStates, feeding }) => {
      const game = document.querySelector("#game").__game;
      const position = game.stateView.playerEntity.position;
      game.transport.send({ type: "set-editor-mode", enabled: true });
      const wx = position.wx + (verifyGroundStates ? 116 : 20);
      const wy = position.wy + 28;
      game.transport.send({ type: "edit-spawn", entityType: type, wx, wy });
      if (feeding) {
        const site = { wx: wx + feeding.dx, wy: wy + feeding.dy };
        if (feeding.prop)
          game.transport.send({ type: "edit-spawn", entityType: feeding.prop, ...site });
        game.transport.send({ type: "edit-spawn", entityType: feeding.resource, ...site });
      }
      game.transport.send({ type: "set-editor-mode", enabled: false });
    },
    { type: candidate.type, verifyGroundStates, feeding },
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
  if (verifyGroundStates) {
    const rideClips = packStage ? ["ride", "ride-sprint"] : [];
    const statesAfterReload = await verifyGroundFaunaInGame(
      page,
      expected,
      states,
      approachClips,
      rideClips,
      !!feeding,
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

async function verifyGroundFaunaInGame(page, expected, clips, approachClips, rideClips, feeding) {
  const passive = clips.flatMap(({ name }, index) => (approachClips.includes(name) ? [] : [index]));
  const action = clips.findIndex(({ name }) => name === "action");
  const states = await page.evaluate(
    async ({ type, sheetKey, passive, action, total, timeout }) => {
      const game = document.querySelector("#game").__game;
      game.playInput.setMovementMode("tap");
      const observed = new Set();
      let nextTarget = 0;
      const end = performance.now() + timeout;
      try {
        while (performance.now() < end) {
          const actor = game.stateView.entities.find((entry) => entry.type === type);
          if (actor?.sprite && game.firstPerson.wildlifeModelDrawn(sheetKey)) {
            const { clip = 0 } = actor.sprite;
            if (clip !== action || actor.wanderAI?.state !== "scared") observed.add(clip);
            if (observed.size === total) break;
            // Wait for the animal's voluntary action before approaching it.
            if (passive.every((index) => observed.has(index))) {
              if (actor.wanderAI?.state === "scared") game.tapMovement.cancel();
              else if (performance.now() >= nextTarget) {
                game.tapMovement.setTarget({ ...actor.position, wz: 0 });
                nextTarget = performance.now() + 350;
              }
            }
          }
          await new Promise(requestAnimationFrame);
        }
      } finally {
        game.tapMovement.cancel();
      }
      return [...observed].sort((a, b) => a - b);
    },
    {
      ...expected,
      passive,
      action,
      total: clips.length - rideClips.length,
      timeout: feeding ? 65_000 : 38_000,
    },
  );
  assert.deepEqual(
    states,
    clips.flatMap(({ name }, index) => (rideClips.includes(name) ? [] : [index])),
    `Reopened game states for ${expected.type}: ${states.map((clip) => clips[clip]?.name).join(", ")}`,
  );
  return states.map((clip) => clips[clip].name);
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
      ["ArrowRight", "ArrowRight"],
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
    await page.keyboard.up("ArrowRight");
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
