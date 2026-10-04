import { type ArtCatalog, required } from "../art/ArtCatalog.js";
import { loadVerifiedArtImage, sha256 } from "../art/ArtSource.js";
import { CHARACTERS, type CharacterDefinition } from "../characters/CharacterCatalog.js";
import { CharacterTestScene } from "../characters/CharacterTestScene.js";
import controllerSource from "../characters/CharacterTestScene.ts?raw";
import collisionSource from "../entities/collision.ts?raw";
import animationSource from "../entities/spriteAnimation.ts?raw";
import physicsSource from "../physics/PlayerMovement.ts?raw";
import surfaceSource from "../physics/surfaceHeight.ts?raw";
import scenarioSource from "../scenarios/CharacterRecipe.ts?raw";
import hostSource from "../scenarios/ScenarioSession.ts?raw";
import realmSource from "../server/Realm.ts?raw";
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
        controller: await sha256(
          new TextEncoder().encode(
            controllerSource +
              scenarioSource +
              realmSource +
              hostSource +
              physicsSource +
              surfaceSource +
              collisionSource +
              animationSource,
          ),
        ),
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
