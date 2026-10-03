import { expect, it } from "vitest";
import { readReloadCamera } from "./ReloadCamera.js";

it("accepts only finite realm-scoped camera state for the current profile", () => {
  const camera = {
    realmId: "interior~world~building~0",
    profileId: "one",
    cameraX: 80,
    cameraY: 120,
    zoom: 2,
  };
  expect(readReloadCamera(JSON.stringify(camera), "one")).toEqual(camera);
  expect(readReloadCamera(JSON.stringify(camera), "two")).toBeNull();
  expect(readReloadCamera(JSON.stringify({ cameraX: 80, cameraY: 120, zoom: 2 }), null)).toBeNull();
  expect(readReloadCamera(JSON.stringify({ ...camera, zoom: 0 }), "one")).toBeNull();
  expect(readReloadCamera("invalid", "one")).toBeNull();
});
