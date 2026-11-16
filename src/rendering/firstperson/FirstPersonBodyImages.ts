import * as THREE from "three";
import type { BodyImage } from "../View3dHost.js";
import { SUN_BODY_LIGHT, type SunUniforms } from "./FirstPersonMaterials.js";

/** Where a body's image goes: its anchor in game axes, and its opacity. */
export interface ImagedBody {
  readonly wx: number;
  readonly wy: number;
  readonly zOffset: number;
  readonly alpha?: number | undefined;
}

/**
 * The square's side on screen. The fixed view draws a vehicle's image over a
 * whole number of screen pixels, so its texels keep one size as the body moves.
 */
export function bodyImagePixels(radius: number, scale: number): number {
  return Math.max(1, Math.round(radius * 2 * scale));
}

/**
 * An image's depth, as the top-down camera's clip depth: `centre` is the
 * anchor's, and `local` the image's depth sample (0…1, 0.5 at the anchor).
 * Both cameras measure north minus height, so one is a scaled copy of the
 * other; `northDepth` is the top-down camera's clip depth per world pixel north.
 */
export function bodyImageDepth(
  centre: number,
  local: number,
  radius: number,
  northDepth: number,
): number {
  return centre + northDepth * 4 * radius * (2 * local - 1);
}

const VERTEX = `
uniform vec3 centre;
uniform float halfSide;
uniform float radius;
varying vec2 vUv;
varying vec2 vDepth;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  mat4 clip = projectionMatrix * viewMatrix;
  // The image lies on the ground plane at the anchor's height: through the
  // top-down camera, north on that plane is up the screen.
  gl_Position = clip * vec4(centre + vec3(position.xy * halfSide, 0.0), 1.0);
  // The pixels carry their own depth; the square's own must only stay in range.
  gl_Position.z = 0.0;
  // See bodyImageDepth. The top-down camera does not turn, so its clip depth
  // per world pixel north is one entry of its projection.
  vDepth = vec2((clip * vec4(centre, 1.0)).z, projectionMatrix[1][2] * 4.0 * radius);
}`;

// The filter is the fixed view's for actor images (GpuRasterShader): the image
// drawn nearest onto the square's own pixel grid, then one bilinear step from
// that grid onto the screen's, so a body between two pixels has soft edges and
// steady texels. As there, the step blends display-encoded colours.
const FRAGMENT = `
uniform sampler2D image;
uniform sampler2D imageDepth;
uniform bool hasDepth;
uniform vec3 centre;
uniform float side;
uniform float radius;
uniform float opacity;
uniform vec3 sunOrigin;
varying vec2 vUv;
varying vec2 vDepth;
${SUN_BODY_LIGHT}
void main() {
  vec2 size = vec2(textureSize(image, 0));
  vec2 p = vUv * side - 0.5;
  vec2 f = fract(p), low = floor(p) + 0.5;
  // Each tap's colour, and its weight: zero outside the image or the body.
  vec4 taps[4];
  float best = 0.0;
  ivec2 bestTexel = ivec2(0);
  for (int k = 0; k < 4; k++) {
    vec2 corner = vec2(float(k & 1), float(k >> 1));
    vec2 at = (low + corner) / side;
    taps[k] = vec4(0.0);
    if (any(lessThan(at, vec2(0.0))) || any(greaterThanEqual(at, vec2(1.0)))) continue;
    ivec2 texel = ivec2(floor(at * size + 0.0001));
    vec4 c = texelFetch(image, texel, 0);
    // The body is what the outline calls occupied. The image's faint contact
    // disc is left out: this scene has its own contact shadows.
    if (c.a < 128.0 / 255.0) continue;
    vec2 w = mix(1.0 - f, f, corner);
    taps[k] = vec4(c.rgb, w.x * w.y);
    if (taps[k].a > best) {
      best = taps[k].a;
      bestTexel = texel;
    }
  }
  if (best <= 0.0) discard;
  // The fragment stands where its heaviest texel does.
  float local = hasDepth ? texelFetch(imageDepth, bestTexel, 0).r : 0.5;
  gl_FragDepth = (vDepth.x + vDepth.y * (2.0 * local - 1.0)) * 0.5 + 0.5;
  // That texel in the scene: across the image is east and north plus height;
  // its depth is north minus height.
  vec2 across = ((vec2(bestTexel) + 0.5) / size * 2.0 - 1.0) * radius;
  float along = 4.0 * radius * (2.0 * local - 1.0);
  vec3 at = centre + vec3(across.x, (across.y + along) * 0.5, (across.y - along) * 0.5);
  vec3 light = sunLightAt(at - sunOrigin);
  vec4 sum = vec4(0.0);
  for (int k = 0; k < 4; k++)
    sum += vec4(linearToOutputTexel(vec4(taps[k].rgb * light, 1.0)).rgb, 1.0) * taps[k].a;
  if (sum.a < 1.0 / 255.0) discard;
  gl_FragColor = vec4(sum.rgb / sum.a, sum.a * opacity);
}`;

interface CardUniforms {
  image: { value: THREE.Texture | null };
  imageDepth: { value: THREE.Texture | null };
  hasDepth: { value: boolean };
  centre: { value: THREE.Vector3 };
  side: { value: number };
  halfSide: { value: number };
  radius: { value: number };
  opacity: { value: number };
}

interface Card {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  readonly uniforms: CardUniforms;
}

/**
 * Vehicle bodies in the top-down camera as the fixed view's own images: outlined,
 * one texel per world pixel, where the scene would otherwise rasterise their
 * meshes at the screen's resolution. Each image is a square on the ground plane
 * whose pixels write their own depth, so bodies still hide behind buildings and
 * each other, and take the sun's shadow where their texels stand.
 *
 * Only the top-down camera can show them: an image is the body seen along that
 * camera's rays.
 */
export class BodyImageCards {
  count = 0;
  private readonly scene = new THREE.Scene();
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly cards: Card[] = [];
  private readonly pending: { body: ImagedBody; image: BodyImage }[] = [];

  constructor(private readonly sun: SunUniforms) {}

  begin(): void {
    this.pending.length = 0;
  }

  push(body: ImagedBody, image: BodyImage): void {
    this.pending.push({ body, image });
  }

  /** Draw the frame's images over the scene already in `camera`'s depth buffer.
   * `scale`: screen pixels per world pixel. */
  draw(renderer: THREE.WebGLRenderer, camera: THREE.Camera, scale: number): void {
    const { pending, cards } = this;
    this.count = pending.length;
    // Soft edges blend, so farther bodies go first: south and up are nearer.
    pending.sort((a, b) => a.body.wy + a.body.zOffset - (b.body.wy + b.body.zOffset));
    for (const [index, { body, image }] of pending.entries()) {
      let card = cards[index];
      if (!card) {
        card = this.card();
        cards.push(card);
        this.scene.add(card.mesh);
      }
      const side = bodyImagePixels(image.radius, scale);
      const u = card.uniforms;
      u.centre.value.set(body.wx, -body.wy, body.zOffset);
      u.image.value = image.texture;
      u.imageDepth.value = image.depth ?? null;
      u.hasDepth.value = !!image.depth;
      u.side.value = side;
      u.halfSide.value = side / (2 * scale);
      u.radius.value = image.radius;
      u.opacity.value = body.alpha ?? 1;
      card.mesh.renderOrder = index;
      card.mesh.visible = true;
    }
    for (let index = pending.length; index < cards.length; index++) {
      const card = cards[index];
      if (!card) continue;
      card.mesh.visible = false;
      // Images belong to the host and last one display frame.
      card.uniforms.image.value = card.uniforms.imageDepth.value = null;
    }
    pending.length = 0;
    if (this.count) renderer.render(this.scene, camera);
  }

  private card(): Card {
    const uniforms: CardUniforms = {
      image: { value: null },
      imageDepth: { value: null },
      hasDepth: { value: false },
      centre: { value: new THREE.Vector3() },
      side: { value: 1 },
      halfSide: { value: 1 },
      radius: { value: 1 },
      opacity: { value: 1 },
    };
    const material = new THREE.ShaderMaterial({
      // The sun's uniforms are the view's own objects: its updates reach every card.
      uniforms: { ...this.sun, ...uniforms },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthTest: true,
      depthWrite: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    return { mesh, uniforms };
  }

  dispose(): void {
    for (const card of this.cards) card.mesh.material.dispose();
    this.cards.length = 0;
    this.geometry.dispose();
  }
}
