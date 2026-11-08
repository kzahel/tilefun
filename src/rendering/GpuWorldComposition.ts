import * as THREE from "three";
import type { RenderRegion } from "./ViewLayout.js";
import { WORLD_RASTER_PAD, type WorldComposite, worldComposite } from "./WorldRasterFrame.js";

/**
 * The padded world render target and its composite onto the canvas. Every view
 * of a display frame (226) reuses the one target: a later view clears it, draws
 * in its top-left corner and composes into its own region or half-plane.
 */
export class GpuWorldComposition {
  readonly target = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  private readonly scene = new THREE.Scene();
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly material = new THREE.ShaderMaterial({
    uniforms: {
      image: { value: null },
      viewport: { value: new THREE.Vector2() },
      offset: { value: new THREE.Vector2() },
      targetSize: { value: new THREE.Vector2() },
      // A diagonal view keeps one half-plane (see worldComposite).
      mask: { value: new THREE.Vector3(0, 0, 1) },
    },
    vertexShader: "varying vec2 uv0; void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}",
    fragmentShader: `uniform sampler2D image; uniform vec2 viewport,offset,targetSize; uniform vec3 mask;
      varying vec2 uv0; void main(){if(dot(mask.xy,gl_FragCoord.xy)+mask.z<0.)discard;
      gl_FragColor=texture2D(image,(uv0*viewport+offset)/targetSize);}`,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });
  private readonly composite = {} as WorldComposite;
  private views = 0;

  constructor() {
    const quad = new THREE.Mesh(this.geometry, this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  /** Size the target to the canvas plus padding; returns its bytes. */
  resize(width: number, height: number): number {
    const pad = WORLD_RASTER_PAD * 2;
    this.target.setSize(width + pad, height + pad);
    return (width + pad) * (height + pad) * 8;
  }

  beginFrame(): void {
    this.views = 0;
  }

  /** Count a view; true from the second view of a frame (its target needs clearing). */
  laterView(): boolean {
    return this.views++ > 0;
  }

  /** Compose the target's top-left view into `region` (the whole canvas by default). */
  present(
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    canvas: { readonly width: number; readonly height: number },
    x: number,
    y: number,
    region?: RenderRegion,
  ): void {
    const u = this.material.uniforms;
    if (!u.image || !u.viewport || !u.targetSize || !u.offset || !u.mask)
      throw Error("World composite uniforms missing");
    const c = worldComposite(this.composite, canvas, this.target.height, x, y, region);
    u.image.value = this.target.texture;
    u.viewport.value.set(c.width, c.height);
    u.targetSize.value.set(this.target.width, this.target.height);
    u.offset.value.set(c.offsetX, c.offsetY);
    u.mask.value.set(c.maskX, c.maskY, c.maskZ);
    renderer.setRenderTarget(null);
    renderer.setScissorTest(false);
    if (!c.partial) {
      renderer.render(this.scene, camera);
      return;
    }
    renderer.setViewport(c.viewportX, c.viewportY, c.width, c.height);
    try {
      renderer.render(this.scene, camera);
    } finally {
      renderer.setViewport(0, 0, canvas.width, canvas.height);
    }
  }

  dispose(): void {
    this.target.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
