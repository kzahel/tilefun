import * as THREE from "three";
import type { Spritesheet } from "../../assets/Spritesheet.js";
import { drawOverlayGeometry } from "../CanvasOverlayRenderer.js";
import type { OverlayDraw } from "../OverlayFrame.js";
import { pixelTexture } from "./FirstPersonImages.js";

/** A diagnostic screen grid placed on the world's ground, behind bodies. */
export class FirstPersonUnderlay {
  private canvas: HTMLCanvasElement | undefined;
  private texture: THREE.Texture | undefined;
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly material = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  readonly mesh = new THREE.Mesh(this.geometry, this.material);
  private key = "";
  constructor(
    parent: THREE.Group,
    private readonly sheets: ReadonlyMap<string, Spritesheet>,
  ) {
    parent.add(this.mesh);
    this.mesh.visible = false;
  }
  update(
    items: readonly OverlayDraw[] | undefined,
    eye: { x: number; y: number },
    scale: number,
    width: number,
    height: number,
  ) {
    this.mesh.visible = !!items?.length;
    if (!items?.length) return;
    const key = JSON.stringify([width, height, items]);
    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
      this.texture = pixelTexture(this.canvas);
      this.material.map = this.texture;
      this.material.needsUpdate = true;
    }
    if (key !== this.key) {
      this.key = key;
      this.canvas.width = width;
      this.canvas.height = height;
      const ctx = this.canvas.getContext("2d");
      if (!ctx) throw Error("Diagnostic grid surface unavailable");
      drawOverlayGeometry(ctx, items, this.sheets);
      if (this.texture) this.texture.needsUpdate = true;
    }
    this.mesh.scale.set(width / scale, height / scale, 1);
    this.mesh.position.set(eye.x, eye.y + 0.05, 0.05);
  }
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.texture?.dispose();
    this.mesh.removeFromParent();
  }
}
