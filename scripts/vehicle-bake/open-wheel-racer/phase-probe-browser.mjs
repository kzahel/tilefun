import * as THREE from "three";
import { createWheelRig } from "../../authored-assets/runtime/wheel-rig.mjs";

export function install() {
  const api = window.familyReview;
  api.pose(45, 0, "study");
  const asset = api.state.asset;
  const original = asset.setTravel.bind(asset);
  const rig = createWheelRig(asset.object, THREE);
  const frontRadius = rig.wheels.find((w) => w.id === "FL").radius;
  const rearRadius = rig.wheels.find((w) => w.id === "RL").radius;
  if (!(rearRadius > frontRadius)) throw Error("Different radii missing");
  const moving = new Set();
  for (const wheel of rig.wheels) wheel.roll.traverse((node) => moving.add(node));
  const fixed = [];
  asset.object.traverse((node) => {
    if (node.isMesh && !moving.has(node)) fixed.push(node);
  });
  function render(kind, phase, mode) {
    asset.setTravel = original;
    const baseline = api.pose(45, 0, mode).pixels;
    asset.object.updateMatrixWorld(true);
    const fixedMatrices = fixed.map((o) => o.matrixWorld.elements.slice());
    const centers = rig.wheels.map((w) => w.roll.getWorldPosition(new THREE.Vector3()));
    const angle = (phase * Math.PI) / 4;
    const ordinaryDistance = frontRadius * angle;
    if (kind === "equal-angle") {
      asset.setTravel = () => {
        for (const w of rig.wheels) rig.setWheelTravel(w.id, w.radius * angle);
      };
    }
    api.pose(45, kind === "ordinary-distance" ? ordinaryDistance : 0, mode);
    asset.object.updateMatrixWorld(true);
    const wheels = rig.wheels.map((w, i) => {
      const travel = kind === "equal-angle" ? w.radius * angle : ordinaryDistance;
      const expected = w.restRoll
        .clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(w.axis, -travel / w.radius));
      const error = w.roll.quaternion.angleTo(expected);
      const pivotError = w.roll.getWorldPosition(new THREE.Vector3()).distanceTo(centers[i]);
      if (error > 1e-6 || pivotError > 1e-6) throw Error(`Wheel phase/pivot ${w.id}`);
      return {
        id: w.id,
        radiusWorld: w.radius,
        travelWorld: travel,
        expectedSignedAngleDegrees: ((-travel / w.radius) * 180) / Math.PI,
        quaternionErrorRadians: error,
        pivotErrorWorld: pivotError,
      };
    });
    for (let i = 0; i < fixed.length; i++)
      if (fixed[i].matrixWorld.elements.some((v, j) => Math.abs(v - fixedMatrices[i][j]) > 1e-6))
        throw Error("Fixed body/equipment moved");
    const png = document.querySelector("#low").toDataURL().split(",")[1];
    asset.setTravel = original;
    const reset = api.pose(45, 0, mode).pixels;
    if (reset.some((v, i) => v !== baseline[i])) throw Error("Pixel reset differs");
    return {
      png,
      kind,
      phaseDegrees: phase * 45,
      mode,
      wheels,
      fixedBodyUnchanged: true,
      pixelExactAbsoluteReset: true,
    };
  }
  return {
    render,
    radii: rig.wheels.map((w) => ({ id: w.id, radius: w.radius })),
    frontRadius,
    rearRadius,
  };
}
