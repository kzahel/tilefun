import * as THREE from "three";

export interface VehicleLightPattern {
  periodSeconds: number;
  pulseWindows: [number, number][];
  peakGain: number;
}

type LightMaterial = THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;

/** Appearance only. Caller supplies shared presentation time and authoritative
 * enable state. Tagged lenses borrow their atlas; housings/body stay untouched.
 * Standard emissive/unlit gain works without a bespoke WebGL-only shader.
 */
export class VehicleEmergencyLights {
  private readonly lenses: {
    mesh: THREE.Mesh;
    original: LightMaterial;
    material: LightMaterial;
    rest: THREE.Color;
    restIntensity: number;
    phase: number;
  }[] = [];
  readonly count: number;

  constructor(
    scene: THREE.Object3D,
    private readonly pattern: VehicleLightPattern,
  ) {
    if (
      !Number.isFinite(pattern.periodSeconds) ||
      pattern.periodSeconds <= 0 ||
      !Number.isFinite(pattern.peakGain) ||
      pattern.peakGain < 1 ||
      !Array.isArray(pattern.pulseWindows) ||
      !pattern.pulseWindows.length ||
      pattern.pulseWindows.some(
        (window) =>
          window.length !== 2 ||
          !window.every(Number.isFinite) ||
          window[0] < 0 ||
          window[1] > 1 ||
          window[0] >= window[1],
      )
    )
      throw Error("Invalid vehicle light pattern");
    try {
      scene.traverse((node) => {
        if (node.userData.tilefun_role !== "emergency-light") return;
        const phase: unknown = node.userData.tilefun_phase;
        if (
          !(node instanceof THREE.Mesh) ||
          node.userData.tilefun_effect_schema !== 1 ||
          node.userData.tilefun_channel !== "emergencyLights" ||
          typeof node.userData.tilefun_group !== "string" ||
          !node.userData.tilefun_group ||
          typeof phase !== "number" ||
          !Number.isFinite(phase) ||
          phase < 0 ||
          phase >= 1 ||
          !(
            node.material instanceof THREE.MeshBasicMaterial ||
            (node.material instanceof THREE.MeshStandardMaterial &&
              node.material.emissiveMap &&
              node.material.emissiveIntensity > 0 &&
              node.material.emissive.r + node.material.emissive.g + node.material.emissive.b > 0)
          )
        )
          throw Error(`Invalid emergency-light lens: ${node.name}`);
        const original = node.material;
        if (
          !(
            original instanceof THREE.MeshBasicMaterial ||
            original instanceof THREE.MeshStandardMaterial
          )
        )
          throw Error(`Unsupported emergency-light material: ${node.name}`);
        const material = original.clone();
        material.toneMapped = false;
        node.material = material;
        this.lenses.push({
          mesh: node,
          original,
          material,
          rest: original.color.clone(),
          restIntensity:
            original instanceof THREE.MeshStandardMaterial ? original.emissiveIntensity : 1,
          phase,
        });
      });
    } catch (error) {
      this.dispose();
      throw error;
    }
    this.count = this.lenses.length;
  }

  /** Absolute state on every draw, including off: cached assets cannot retain
   * another entity's flash. There is no renderer-local timer or wheel rotation.
   */
  setState(enabled: boolean, timeSeconds: number) {
    if (!Number.isFinite(timeSeconds)) throw Error("Vehicle light time must be finite");
    for (const lens of this.lenses) {
      const phase = (((timeSeconds / this.pattern.periodSeconds + lens.phase) % 1) + 1) % 1;
      const bright =
        enabled && this.pattern.pulseWindows.some(([start, end]) => phase >= start && phase < end);
      const gain = bright ? this.pattern.peakGain : 1;
      if (lens.material instanceof THREE.MeshStandardMaterial)
        lens.material.emissiveIntensity = lens.restIntensity * gain;
      else lens.material.color.copy(lens.rest).multiplyScalar(gain);
    }
  }

  dispose() {
    for (const lens of this.lenses) {
      lens.mesh.material = lens.original;
      lens.material.dispose();
    }
    this.lenses.length = 0;
  }
}
