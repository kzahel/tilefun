import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { naturalLandscapeRecipe } from "../scenarios/NaturalLandscapeRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { faunaProfile, faunaType } from "./Fauna.js";

it("a generated buffalo herd shares a landing alarm once and both recover after their committed walks", async () => {
  const type = faunaType("water-buffalo"),
    p = required(faunaProfile(type));
  const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
  const s = await ScenarioSession.create(naturalLandscapeRecipe("water-buffalo", "thicket"));
  const herd = () => s.realm.entityManager.entities.filter((e) => e.type === type);
  try {
    for (
      let i = 0;
      i < 720 && !herd().some((e) => e.sprite?.clip === 1 && e.sprite.frameCol >= 4);
      i++
    )
      await s.step(idle);
    expect(herd().some((e) => e.sprite?.clip === 1)).toBe(true);
    await s.reload();
    for (let i = 0; i < 360 && !herd().some((e) => e.sprite?.clip === 0); i++) await s.step(idle);
    const target = required(herd().find((e) => e.wanderAI?.state !== "scared"));
    await s.command({ kind: "teleport", position: { ...target.position }, z: p.body[2] + 2 });
    const alarmed = new Set<number>();
    let recovered = false;
    for (let i = 0; i < 720; i++) {
      await s.step(idle);
      for (const e of herd()) if (e.wanderAI?.state === "scared") alarmed.add(e.id);
      if (alarmed.size === p.group && herd().every((e) => e.wanderAI?.state !== "scared")) {
        recovered = true;
        break;
      }
    }
    expect(alarmed.size).toBe(p.group);
    expect(recovered).toBe(true);
    expect(herd().every((e) => !e.fauna?.alarmFrom)).toBe(true);
  } finally {
    await s.close();
  }
}, 20000);
