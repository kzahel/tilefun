import classicPlayerFiles from "../../public/demos/classic-player-3d/v1/review.json";
import type { ArtCatalog } from "../art/ArtCatalog.js";
import { loadVerifiedArtImage, sha256 } from "../art/ArtSource.js";
import { CHARACTERS, type CharacterDefinition } from "../characters/CharacterCatalog.js";
import { CharacterTestScene } from "../characters/CharacterTestScene.js";
import { required } from "../shared/required.js";
import { ENGINE_REVIEW_REVISION } from "./EngineReviewRevision.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

/** All sixteen poses rendered with production anchoring, shadows and fixture depth. */
export async function buildCharacterCandidate(def: CharacterDefinition, catalog: ArtCatalog) {
  const sheet = required(catalog.sheets.find((s) => s.id === def.sheetKey));
  const [image, player] = await Promise.all([
    loadVerifiedArtImage(sheet),
    loadVerifiedArtImage(required(catalog.sheets.find((s) => s.id === "player"))),
  ]);
  const scene = new CharacterTestScene(def, def.defaults, image, player);
  const canvas = document.createElement("canvas"),
    hashes: string[] = [];
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 4; col++) {
      required(scene.actor.sprite).frameRow = row;
      required(scene.actor.sprite).frameCol = col;
      scene.draw(canvas, true, 1, false);
      hashes.push(
        await sha256(
          required(canvas.getContext("2d")).getImageData(0, 0, canvas.width, canvas.height).data,
        ),
      );
    }
  const fingerprint = await sha256(
    new TextEncoder().encode(
      JSON.stringify({
        definition: def,
        source: sheet.fingerprint,
        poses: hashes,
        engine: ENGINE_REVIEW_REVISION,
      }),
    ),
  );
  const candidate: WorkshopCandidate = {
    id: `character:${def.id}`,
    batchId: "character-lab",
    kind: "character",
    name: def.name,
    prompt:
      "Test all four directions, stopping, feet, ground bounds, height, stairs and depth sorting. Save the exact settings you tested.",
    url: `/tilefun/workshop.html#/tool/character-lab?character=${def.id}`,
    fingerprint,
    sourceFingerprint: sheet.fingerprint,
    characterId: def.id,
  };
  // The interactive host borrows verified source/fixture imagery, not this reference renderer.
  return { candidate, image, player, sheets: scene.sheets };
}
export async function buildCharacterCandidates(catalog: ArtCatalog) {
  const results: WorkshopCandidate[] = [];
  for (const def of CHARACTERS)
    results.push((await buildCharacterCandidate(def, catalog)).candidate);
  return results;
}

/** The standing model is an orbitable study with its own identity and review surface. */
export async function buildClassicPlayerStudy(catalog: ArtCatalog): Promise<WorkshopCandidate> {
  const url = "/tilefun/demos/classic-player-3d/v1/";
  for (const [name, expected] of Object.entries(classicPlayerFiles)) {
    const file = await fetch(url + name);
    if (!file.ok || (await sha256(new Uint8Array(await file.arrayBuffer()))) !== expected)
      throw new Error(`Classic Player study evidence missing or changed: ${name}`);
  }
  const sourceFingerprint = required(catalog.sheets.find((s) => s.id === "player")).fingerprint;
  return {
    id: "projection:classic-player-standing-v1",
    batchId: "classic-player-3d",
    name: "Classic Player · standing cat",
    prompt:
      "Compare the ears, cheeks, collar and paws with the original sprite. Orbit the model and switch between Idle and Walk.",
    kind: "projection",
    url: `${url}index.html`,
    sourceFingerprint,
    fingerprint: await sha256(
      new TextEncoder().encode(JSON.stringify([sourceFingerprint, classicPlayerFiles])),
    ),
  };
}
