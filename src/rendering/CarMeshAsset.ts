import * as THREE from "three";
import { CAR_PROXY, carProxyPatches, sourceUV } from "../projection/CarProxy.js";
import { extendOpaqueEdges } from "../projection/ProxyTexture.js";
import { carVertexToLocal } from "./CarMeshDefinition.js";

/** Diagnostic asset adapter. Geometry/source provenance is shared with the original
 * projection lab. That older source-comparison tool retains its reference adapter.
 */
export class CarMeshAsset {
  readonly object = new THREE.Group();
  private readonly resources: { dispose(): void }[] = [];
  constructor(image: CanvasImageSource) {
    const source = document.createElement("canvas");
    source.width = 64;
    source.height = 40;
    const ctx = source.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw Error("Car source unavailable");
    ctx.drawImage(image, ...CAR_PROXY.rect, 0, 0, 64, 40);
    const top = document.createElement("canvas");
    top.width = 64;
    top.height = 40;
    const topCtx = top.getContext("2d");
    if (!topCtx) throw Error("Car top texture unavailable");
    const pixels = ctx.getImageData(0, 0, 64, 40);
    pixels.data.set(extendOpaqueEdges(pixels.data, 64, 40));
    topCtx.putImageData(pixels, 0, 0);
    const texture = (canvas: HTMLCanvasElement) => {
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.magFilter = t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      this.resources.push(t);
      return t;
    };
    const side = new THREE.MeshBasicMaterial({
      map: texture(source),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    const upper = new THREE.MeshBasicMaterial({ map: texture(top), side: THREE.DoubleSide });
    const unknown = new THREE.MeshBasicMaterial({ color: 0xeea143, side: THREE.DoubleSide });
    this.resources.push(side, upper, unknown);
    for (const patch of carProxyPatches()) {
      const geometry = new THREE.BufferGeometry();
      // Source car faces -X; normalize once to +X with a half turn about Z.
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          patch.vertices.flatMap((p) => [...carVertexToLocal(p)]),
          3,
        ),
      );
      geometry.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(
          patch.vertices.flatMap((p) => [...sourceUV(p)]),
          2,
        ),
      );
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.computeVertexNormals();
      this.resources.push(geometry);
      this.object.add(
        new THREE.Mesh(
          geometry,
          patch.surface === "top" ? upper : patch.surface === "side" ? side : unknown,
        ),
      );
    }
  }
  dispose() {
    for (const resource of this.resources) resource.dispose();
    this.object.clear();
  }
}
export async function loadCarMesh(): Promise<CarMeshAsset> {
  const image = new Image();
  image.src = `${import.meta.env.BASE_URL}assets/tilesets/me-complete.png`;
  await image.decode();
  return new CarMeshAsset(image);
}
