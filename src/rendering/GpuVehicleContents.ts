import * as THREE from "three";
import type { Spritesheet } from "../assets/Spritesheet.js";
import { meshBedFoot } from "./MeshGradePose.js";
import type { SpriteItem } from "./SceneItem.js";

/** Backend-owned bounded pool; the collector only supplies neutral sprite data. */
export class GpuVehicleContents {
  readonly group = new THREE.Group();
  private textures = new Map<CanvasImageSource, THREE.Texture>();
  private planes: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  prepare(owner: SpriteItem, sheets: ReadonlyMap<string, Spritesheet>): boolean {
    const contents = owner.bedGroup?.contents ?? [];
    if (contents.some((item) => !sheets.has(item.sheetKey))) return false;
    this.planes.forEach((plane) => {
      plane.visible = false;
    });
    for (const [index, item] of contents.entries()) {
      let plane = this.planes[index];
      if (!plane) {
        plane = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({
            alphaTest: 0.5,
            side: THREE.DoubleSide,
            toneMapped: false,
          }),
        );
        plane.rotation.x = Math.PI / 2;
        this.planes.push(plane);
        this.group.add(plane);
      }
      plane.visible = !item.flashHidden;
      const sheet = sheets.get(item.sheetKey);
      if (!sheet) return false;
      let texture = this.textures.get(sheet.image);
      if (!texture) {
        // Canvas upload has consistent UV orientation for both HTMLImage and
        // ImageBitmap sheets (WebGL ignores flipY for ImageBitmap uploads).
        const source = document.createElement("canvas");
        source.width = sheet.image.width;
        source.height = sheet.image.height;
        const context = source.getContext("2d");
        if (!context) return false;
        context.drawImage(sheet.image, 0, 0);
        texture = new THREE.Texture(source);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        this.textures.set(sheet.image, texture);
      }
      plane.material.map = texture;
      plane.material.opacity = item.alpha ?? 1;
      plane.material.transparent = plane.material.opacity < 1;
      const region = sheet.getRegion(item.frameCol, item.frameRow);
      const u0 = region.x / sheet.image.width,
        u1 = (region.x + region.width) / sheet.image.width;
      const v0 = 1 - (region.y + region.height) / sheet.image.height,
        v1 = 1 - region.y / sheet.image.height;
      const uv = plane.geometry.getAttribute("uv");
      uv.setXY(0, u0, v1);
      uv.setXY(1, u1, v1);
      uv.setXY(2, u0, v0);
      uv.setXY(3, u1, v0);
      uv.needsUpdate = true;
      const height = item.spriteHeight * (item.scaleY ?? 1);
      const foot = meshBedFoot(owner, item);
      plane.position.set(foot.x, foot.y, foot.z + height / 2 - item.drawOffsetY);
      plane.scale.set((item.flipX ? -1 : 1) * item.spriteWidth, height, 1);
    }
    return true;
  }
  clear() {
    for (const texture of this.textures.values()) texture.dispose();
    this.textures.clear();
    for (const plane of this.planes) {
      plane.geometry.dispose();
      plane.material.dispose();
    }
    this.planes.length = 0;
    this.group.clear();
  }
}
