import { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { PREDATOR_PROFILES, predatorType } from "./Predator.js";

// Query the production generator, rather than injecting scene-only animals.
const nature = new NaturalLandscape(regionalWorld(2026), "thicket");
export const predatorHomes = new Map<
  string,
  { wx: number; wy: number; home: { wx: number; wy: number } }
>();
for (const p of PREDATOR_PROFILES) {
  if (!p.expansion) continue;
  const [x, y] = p.expansion.inspection;
  // Rounded inspection tiles can lie across a chunk boundary from the actual home.
  for (const dy of [0, -1, 1])
    for (const dx of [0, -1, 1]) {
      for (const a of nature.wildlife(Math.floor(x / 16) + dx, Math.floor(y / 16) + dy)) {
        if (a.predator && a.type === predatorType(p.species) && !predatorHomes.has(a.type))
          predatorHomes.set(a.type, { wx: a.wx, wy: a.wy, home: a.predator.home });
      }
    }
}
for (let gy = -12; gy < 12 && predatorHomes.size < PREDATOR_PROFILES.length; gy++)
  for (let gx = -12; gx < 12 && predatorHomes.size < PREDATOR_PROFILES.length; gx++)
    for (let dy = 0; dy < 4; dy++)
      for (let dx = 0; dx < 4; dx++)
        for (const a of [
          ...nature.predators(gx * 4 + dx, gy * 4 + dy),
          ...nature.fiercePredators(gx * 4 + dx, gy * 4 + dy),
        ])
          if (a.predator && !predatorHomes.has(a.type))
            predatorHomes.set(a.type, { wx: a.wx, wy: a.wy, home: a.predator.home });
