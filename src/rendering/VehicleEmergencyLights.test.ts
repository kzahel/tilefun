import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { VehicleEmergencyLights, type VehicleLightPattern } from "./VehicleEmergencyLights.js";

const pattern: VehicleLightPattern = {
  periodSeconds: 1,
  pulseWindows: [
    [0, 0.12],
    [0.2, 0.32],
  ],
  peakGain: 4,
};

function fixture() {
  const scene = new THREE.Group();
  const atlas = new THREE.Texture();
  const original = new THREE.MeshBasicMaterial({ map: atlas });
  const body = new THREE.Mesh(new THREE.BoxGeometry(), original);
  scene.add(body);
  const makeLens = (phase: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
    mesh.userData = {
      tilefun_effect_schema: 1,
      tilefun_role: "emergency-light",
      tilefun_channel: "emergencyLights",
      tilefun_group: `group-${phase}`,
      tilefun_phase: phase,
    };
    scene.add(mesh);
    return mesh;
  };
  const lenses = [makeLens(0), makeLens(0.5)] as const;
  return { scene, atlas, original, body, lenses };
}

describe("tagged vehicle emergency lights", () => {
  it("alternates double pulses, retains atlas paint and leaves shared body material unchanged", () => {
    const { scene, atlas, original, body, lenses } = fixture();
    const effect = new VehicleEmergencyLights(scene, pattern);
    effect.setState(true, 0.05);
    expect(lenses.map((lens) => lens.material.color.r)).toEqual([4, 1]);
    effect.setState(true, 0.55);
    expect(lenses.map((lens) => lens.material.color.r)).toEqual([1, 4]);
    effect.setState(true, 1.25);
    expect(lenses.map((lens) => lens.material.color.r)).toEqual([4, 1]);
    effect.setState(true, 0.4);
    expect(lenses.map((lens) => lens.material.color.r)).toEqual([1, 1]);
    expect(body.material).toBe(original);
    expect(original.color.r).toBe(1);
    expect(lenses.every((lens) => lens.material.map === atlas)).toBe(true);
    effect.dispose();
  });

  it("resets for another entity's off draw and only disposes owned materials", () => {
    const { scene, atlas, original, lenses } = fixture();
    const originalDispose = vi.spyOn(original, "dispose");
    const atlasDispose = vi.spyOn(atlas, "dispose");
    const effect = new VehicleEmergencyLights(scene, pattern);
    effect.setState(true, 0.05);
    effect.setState(false, 0.05);
    expect(lenses.map((lens) => lens.material.color.r)).toEqual([1, 1]);
    effect.dispose();
    expect(lenses.every((lens) => lens.material === original)).toBe(true);
    expect(originalDispose).not.toHaveBeenCalled();
    expect(atlasDispose).not.toHaveBeenCalled();
  });

  it("rejects malformed tagged assets without leaving partially rebound materials", () => {
    const { scene, original, lenses } = fixture();
    lenses[1].userData.tilefun_phase = Number.NaN;
    expect(() => new VehicleEmergencyLights(scene, pattern)).toThrow(
      "Invalid emergency-light lens",
    );
    expect(lenses.every((lens) => lens.material === original)).toBe(true);
    expect(() => new VehicleEmergencyLights(scene, { ...pattern, periodSeconds: 0 })).toThrow(
      "Invalid vehicle light pattern",
    );
  });

  it("brightens imported emissive paint without changing the shared body emitter", () => {
    const { scene, lenses } = fixture();
    const paint = new THREE.MeshStandardMaterial({
      emissiveMap: new THREE.Texture(),
      emissive: 0xffffff,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(), paint);
    scene.add(body);
    for (const lens of lenses) Object.assign(lens, { material: paint });
    const effect = new VehicleEmergencyLights(scene, pattern);
    effect.setState(true, 0.05);
    expect((lenses[0].material as unknown as THREE.MeshStandardMaterial).emissiveIntensity).toBe(4);
    expect(paint.emissiveIntensity).toBe(1);
    effect.setState(false, 0.05);
    expect((lenses[0].material as unknown as THREE.MeshStandardMaterial).emissiveIntensity).toBe(1);
    effect.dispose();
    expect(body.material).toBe(paint);
  });
});
