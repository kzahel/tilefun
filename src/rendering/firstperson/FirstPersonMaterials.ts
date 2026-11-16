import type * as THREE from "three";
import { CHUNK_SIZE_PX } from "../../config/constants.js";

/** Shared by every material that receives the sun's shadow (tactical 247). Scene
 * axes: X east, Y north, Z up. */
export interface SunUniforms {
  sunMap: { value: THREE.Texture | null };
  /** Origin-relative scene position → the shadow map's clip coordinates. */
  sunMatrix: { value: THREE.Matrix4 };
  sunOrigin: { value: THREE.Vector3 };
  /** Unit vector toward the sun. */
  sunDir: { value: THREE.Vector3 };
  /** Eye relative to the origin (x, y), then the fade's start and end distances. */
  sunFade: { value: THREE.Vector4 };
  /** Linear colour multiplier inside a shadow. */
  sunShade: { value: THREE.Color };
}

/**
 * How a surface takes the shadow:
 * - `faces`: static world geometry, which is also drawn into the shadow map. Faces
 *   turned away from the sun keep their baked shade; lit faces sample from just
 *   off their surface.
 * - `body`: moving bodies that are not in the map (vehicles, actors): every pixel
 *   samples at its own position.
 * - `card`: standing cards that are in the map facing the sun. They sample from
 *   the sunny side of their own shadow card, so only neighbours darken them.
 */
export type SunReceiver = "faces" | "body" | "card";

export interface MaterialShading {
  /** Expand `corner` offsets along this horizontal axis (game axes). */
  card?: { value: THREE.Vector2 } | undefined;
  /** Ground faces wear their chunk's page of this atlas (see `FirstPersonGround`). */
  ground?: { value: THREE.Texture | null } | undefined;
  /** Cards show their `cardPage` place in this atlas (see `CardArrays`). */
  cardArt?: { value: THREE.Texture | null } | undefined;
  sun?: { uniforms: SunUniforms; receiver: SunReceiver } | undefined;
}

/** `sunLightAt(p)`: the colour multiplier at `p`, a scene position relative to
 * `sunOrigin`. */
const SUN_LIGHT = (receiver: SunReceiver) => `
uniform highp sampler2DShadow sunMap;
uniform mat4 sunMatrix;
uniform vec3 sunDir;
uniform vec4 sunFade;
uniform vec3 sunShade;
vec3 sunLightAt(vec3 p) {
  float fade = smoothstep(sunFade.z, sunFade.w, distance(p.xy, sunFade.xy));
  if (fade >= 1.0) return vec3(1.0);
  ${
    receiver === "faces"
      ? `vec3 n = normalize(cross(dFdx(p), dFdy(p)));
  if (dot(n, sunDir) <= 0.02) return vec3(1.0);
  p += n;`
      : ""
  }
  p += sunDir * 1.5;
  vec3 at = (sunMatrix * vec4(p, 1.0)).xyz * 0.5 + 0.5;
  // A high point near the fade's end can project past the map's edge: lit.
  if (at.x < 0.0 || at.x > 1.0 || at.y < 0.0 || at.y > 1.0) return vec3(1.0);
  float lit = mix(texture(sunMap, at), 1.0, fade);
  return mix(sunShade, vec3(1.0), lit);
}
`;

/** The `body` receiver's `sunLightAt`, for shaders that work out their own
 * positions (vehicle images, whose pixels carry a depth). They declare
 * `sunOrigin` and take the rest of `SunUniforms` as they are. */
export const SUN_BODY_LIGHT = SUN_LIGHT("body");

const SUN_FRAGMENT = (receiver: SunReceiver) => `${SUN_LIGHT(receiver)}
varying vec3 vSunLocal;
vec3 sunLight() {
  return sunLightAt(vSunLocal);
}
`;

/**
 * A ground face's artwork: its chunk's page of the fixed view's page atlas (250).
 * `groundPage` is the page's corner in its layer and the layer, or layer −1 while
 * the chunk has no page; `groundTexel` is the place in the chunk's image, or −1
 * on faces without artwork (cliff walls). Either case keeps the vertex colour.
 * Lookups stay inside the page: its neighbours in the layer are other images.
 */
/** Sample positions inside one screen pixel (a rotated grid), in pixel units. */
const GROUND_TAPS = [
  [0.125, 0.375],
  [-0.125, -0.375],
  [0.375, -0.125],
  [-0.375, 0.125],
] as const;
/**
 * Prototype for the top-down sampling rule (renderer film, 2026-11-16): ground
 * artwork sampled once at the pixel's centre, as cards are, instead of averaged
 * over four samples. Shared by every view; each sets it before it draws.
 */
export const GROUND_NEAREST = { value: false };

const GROUND_FRAGMENT = `
uniform highp sampler2DArray groundAtlas;
uniform bool groundNearest;
varying vec2 vGroundTexel;
varying vec3 vGroundPage;
vec3 groundAt(vec2 texel) {
  texel = clamp(texel, vec2(0.5), vec2(${CHUNK_SIZE_PX}.0 - 0.5));
  // Pages store their rows bottom first.
  vec2 at = vGroundPage.xy + vec2(texel.x, ${CHUNK_SIZE_PX}.0 - texel.y);
  vec3 uvw = vec3(at / vec2(textureSize(groundAtlas, 0).xy), floor(vGroundPage.z + 0.5));
  // Pages hold display-encoded bytes; the scene shades in linear light.
  return sRGBTransferEOTF(textureLod(groundAtlas, uvw, 0.0)).rgb;
}
// dx and dy are the texel steps to the next screen pixel. The caller takes
// them outside its branch: derivatives are undefined inside non-uniform control flow.
vec3 groundArt(vec2 dx, vec2 dy) {
  if (groundNearest) return groundAt(vGroundTexel);
  vec3 sum = vec3(0.0);
  ${GROUND_TAPS.map(([x, y]) => `sum += groundAt(vGroundTexel + ${x.toFixed(4)} * dx + ${y.toFixed(4)} * dy);`).join("\n  ")}
  return sum / ${GROUND_TAPS.length}.0;
}
`;

/**
 * Prototype (fractional zoom, 2026-11-16): cards sampled at the ground's four
 * taps per pixel instead of once at its centre. At whole screen pixels per texel
 * the taps share a texel and nothing changes; between, a pixel takes the
 * coverage-weighted colour of the texels under it, so a one-texel detail (an
 * eye) dims instead of vanishing. Shared by every view; each sets it.
 */
export const CARD_TAPS = { value: false };

/** A card's artwork: `cardPage` is its place in the page atlas (texel x, texel y,
 * layer). Alpha is the artwork's own, for the material's alpha test. With
 * `cardTaps`, taps outside the card's own quad (`vCardLocal`, 0…1 across it)
 * count as empty: the atlas around it holds other frames. */
const CARD_ART_FRAGMENT = `
uniform highp sampler2DArray cardAtlas;
uniform bool cardTaps;
varying vec3 vCardPage;
varying vec2 vCardLocal;
vec4 cardAt(vec2 texel) {
  vec3 uvw = vec3(texel / vec2(textureSize(cardAtlas, 0).xy), floor(vCardPage.z + 0.5));
  // Pages hold display-encoded bytes; the scene shades in linear light.
  return sRGBTransferEOTF(textureLod(cardAtlas, uvw, 0.0));
}
vec4 cardArt() {
  vec2 dx = dFdx(vCardPage.xy), dy = dFdy(vCardPage.xy);
  vec2 lx = dFdx(vCardLocal), ly = dFdy(vCardLocal);
  if (!cardTaps) return cardAt(vCardPage.xy);
  vec4 sum = vec4(0.0);
  ${GROUND_TAPS.map(
    ([x, y]) => `{
    vec2 local = vCardLocal + ${x.toFixed(4)} * lx + ${y.toFixed(4)} * ly;
    if (all(greaterThanEqual(local, vec2(0.0))) && all(lessThanEqual(local, vec2(1.0)))) {
      vec4 c = cardAt(vCardPage.xy + ${x.toFixed(4)} * dx + ${y.toFixed(4)} * dy);
      sum += vec4(c.rgb * c.a, c.a);
    }
  }`,
  ).join("\n  ")}
  return vec4(sum.rgb / max(sum.a, 1e-4), sum.a / ${GROUND_TAPS.length}.0);
}
`;

/**
 * Adds the view's shading to one of Three's built-in materials by editing its
 * shader source: shader-expanded cards (see `CardArrays`), card and ground
 * artwork from the page atlas, and the sun's shadow.
 */
export function shadeMaterial<T extends THREE.Material>(material: T, shading: MaterialShading): T {
  const { card, sun, ground, cardArt } = shading;
  if (!card && !sun && !ground && !cardArt) return material;
  material.customProgramCacheKey = () =>
    `fp:${card ? "card" : ""}:${sun?.receiver ?? ""}:${ground ? "ground" : ""}:${cardArt ? "art" : ""}`;
  material.onBeforeCompile = (shader) => {
    let vertex = shader.vertexShader;
    let fragment = shader.fragmentShader;
    const declare: string[] = [];
    if (cardArt) {
      shader.uniforms.cardAtlas = cardArt;
      shader.uniforms.cardTaps = CARD_TAPS;
      declare.push(
        "attribute vec3 cardPage;",
        "varying vec3 vCardPage;",
        "varying vec2 vCardLocal;",
      );
      // Cards are quads of four vertices: bottom-left, bottom-right, top-right, top-left.
      vertex = vertex.replace(
        "#include <color_vertex>",
        `#include <color_vertex>
  vCardPage = cardPage;
  int cardCorner = gl_VertexID % 4;
  vCardLocal = vec2(cardCorner == 1 || cardCorner == 2 ? 1.0 : 0.0, cardCorner >= 2 ? 1.0 : 0.0);`,
      );
      fragment = fragment
        .replace("#include <common>", `#include <common>${CARD_ART_FRAGMENT}`)
        .replace("#include <map_fragment>", "diffuseColor *= cardArt();");
    }
    if (ground) {
      shader.uniforms.groundAtlas = ground;
      shader.uniforms.groundNearest = GROUND_NEAREST;
      declare.push(
        "attribute vec2 groundTexel;",
        "attribute vec3 groundPage;",
        "varying vec2 vGroundTexel;",
        "varying vec3 vGroundPage;",
      );
      vertex = vertex.replace(
        "#include <color_vertex>",
        "#include <color_vertex>\n  vGroundTexel = groundTexel;\n  vGroundPage = groundPage;",
      );
      fragment = fragment
        .replace("#include <common>", `#include <common>${GROUND_FRAGMENT}`)
        .replace(
          "#include <color_fragment>",
          `vec2 groundDx = dFdx(vGroundTexel), groundDy = dFdy(vGroundTexel);
  if (vGroundPage.z > -0.5 && vGroundTexel.x > -0.5)
    diffuseColor.rgb = groundArt(groundDx, groundDy);
  else {
    #include <color_fragment>
  }`,
        );
    }
    if (card) {
      shader.uniforms.cardRight = card;
      declare.push("attribute vec2 corner;", "uniform vec2 cardRight;");
      vertex = vertex.replace(
        "#include <begin_vertex>",
        "vec3 transformed = position + vec3(cardRight * corner.x, corner.y);",
      );
    }
    if (sun) {
      Object.assign(shader.uniforms, sun.uniforms);
      declare.push("uniform vec3 sunOrigin;", "varying vec3 vSunLocal;");
      if (sun.receiver === "card") declare.push("uniform vec3 sunDir;");
      vertex = vertex.replace(
        "#include <project_vertex>",
        `#include <project_vertex>
  vec4 sunPosition = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    sunPosition = batchingMatrix * sunPosition;
  #endif
  #ifdef USE_INSTANCING
    sunPosition = instanceMatrix * sunPosition;
  #endif
  vSunLocal = (modelMatrix * sunPosition).xyz - sunOrigin;
  ${
    sun.receiver === "card" ? "vSunLocal.xy += normalize(sunDir.xy) * (abs(corner.x) + 2.0);" : ""
  }`,
      );
      fragment = fragment
        .replace("#include <common>", `#include <common>${SUN_FRAGMENT(sun.receiver)}`)
        .replace(
          "#include <opaque_fragment>",
          "outgoingLight *= sunLight();\n#include <opaque_fragment>",
        );
    }
    shader.vertexShader = vertex.replace(
      "#include <common>",
      `#include <common>\n${declare.join("\n")}`,
    );
    shader.fragmentShader = fragment;
  };
  material.needsUpdate = true;
  return material;
}
