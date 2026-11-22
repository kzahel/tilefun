import * as THREE from "three";
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
  /** World pixels per map texel (`sunMapScale`): receivers sample this much
   * further off their surface. */
  sunTexel: { value: number };
  /** Dynamic shadows (266): the frame's map of moving bodies. While they are off
   * it is the sun's own map, since a sampler must have a depth texture bound. */
  dynMap: { value: THREE.Texture | null };
  /** `sunOrigin`-relative scene position → the dynamic map's clip coordinates. */
  dynMatrix: { value: THREE.Matrix4 };
  /** As `sunFade`, for the dynamic map; a fade ending at 0 turns it off. */
  dynFade: { value: THREE.Vector4 };
  /** World pixels per texel of the dynamic map. */
  dynTexel: { value: number };
}

/**
 * How a surface takes the shadow:
 * - `faces`: static world geometry, which is also drawn into the shadow map. Faces
 *   turned away from the sun keep their baked shade; lit faces sample from just
 *   off their surface.
 * - `body`: surfaces in neither map (grass): every pixel samples at its own
 *   position.
 * - `solid`: moving meshes (vehicles, cargo, animal models). The sun's map as
 *   `body`. They are in the dynamic map, so there their sides turned away from
 *   the sun are in shadow and the rest sample from just off their surface.
 * - `actor`: moving cards. The sun's map as `body`. The dynamic map holds them
 *   facing the sun, so there the half behind that card samples from further
 *   along its own ray to the sun, past the card.
 * - `card`: standing cards that are in the map facing the sun. They sample from
 *   the sunny side of their own shadow card, so only neighbours darken them. The
 *   dynamic map does not hold them: there they sample where they stand.
 * - `image`: vehicle images, whose pixels work out their own positions. As
 *   `solid` without a surface direction: they sample further towards the sun.
 */
export type SunReceiver = "faces" | "body" | "solid" | "actor" | "card" | "image";
export type GroundAtlas = { value: THREE.Texture | null };
export type GroundSurface = "top" | "cliff";

export interface MaterialShading {
  /** Expand `corner` offsets along this horizontal axis (game axes). */
  card?: { value: THREE.Vector2 } | undefined;
  /** Ground faces wear their chunk's page of this atlas (see `FirstPersonGround`). */
  ground?: { atlas: GroundAtlas; surface: GroundSurface } | undefined;
  /** Cards show their `cardPage` place in this atlas (see `CardArrays`). */
  cardArt?: { value: THREE.Texture | null } | undefined;
  sun?: { uniforms: SunUniforms; receiver: SunReceiver } | undefined;
}

/** Where a receiver samples the dynamic map from, and its light there (GLSL).
 * `p` is the surface, `n` its side facing the eye (`faces`, `solid`). */
const DYNAMIC_LIGHT: Record<SunReceiver, string> = {
  // Static surfaces are not in the map: nothing to keep clear of but its texels.
  faces: "sunMapLight(dynMap, dynMatrix, p + n * dynTexel + sunDir * 0.5 * dynTexel)",
  body: "sunMapLight(dynMap, dynMatrix, p + sunDir * 0.5 * dynTexel)",
  // `p` was moved towards the sun for the sun's own map: back to the card.
  card: "sunMapLight(dynMap, dynMatrix, p - vec3(normalize(sunDir.xy) * vSunLift, 0.0) + sunDir * 0.5 * dynTexel)",
  solid: `(facing <= 0.02 ? 0.0
      : sunMapLight(dynMap, dynMatrix, p + n * dynTexel + sunDir * 0.5 * dynTexel))`,
  // Along the ray to the sun, so the lookup stays on the texel the point's own
  // shadow falls on: only what is higher on that ray than its own card shades it.
  actor:
    "sunMapLight(dynMap, dynMatrix, p + sunDir * (vSunLift / length(sunDir.xy) + 0.5 * dynTexel))",
  // An image's texel is a world pixel: its position is that coarse.
  image: "sunMapLight(dynMap, dynMatrix, p + sunDir * (1.5 * dynTexel + 1.0))",
};

/** `sunLightAt(p)`: the colour multiplier at `p`, a scene position relative to
 * `sunOrigin`: the darker of the sun's map and the dynamic map. */
const SUN_LIGHT = (receiver: SunReceiver) => {
  const sided = receiver === "faces" || receiver === "solid";
  return `
uniform highp sampler2DShadow sunMap;
uniform highp sampler2DShadow dynMap;
uniform mat4 sunMatrix;
uniform mat4 dynMatrix;
uniform vec3 sunDir;
uniform vec4 sunFade;
uniform vec4 dynFade;
uniform vec3 sunShade;
uniform float sunTexel;
uniform float dynTexel;
${receiver === "actor" || receiver === "card" ? "varying float vSunLift;" : ""}
float sunMapLight(highp sampler2DShadow map, mat4 matrix, vec3 p) {
  vec3 at = (matrix * vec4(p, 1.0)).xyz * 0.5 + 0.5;
  // A high point near the fade's end can project past the map's edge: lit.
  if (at.x < 0.0 || at.x > 1.0 || at.y < 0.0 || at.y > 1.0) return 1.0;
  return texture(map, at);
}
vec3 sunLightAt(vec3 p) {
  ${
    sided
      ? `// Before any branch: derivatives are undefined after one.
  vec3 n = normalize(cross(dFdx(p), dFdy(p)));
  float facing = dot(n, sunDir);`
      : ""
  }
  float fade = smoothstep(sunFade.z, sunFade.w, distance(p.xy, sunFade.xy));
  float dynamicFade = smoothstep(dynFade.z, dynFade.w, distance(p.xy, dynFade.xy));
  if (fade >= 1.0 && dynamicFade >= 1.0) return vec3(1.0);
  ${receiver === "faces" ? "if (facing <= 0.02) return vec3(1.0);" : ""}
  float lit = 1.0;
  if (fade < 1.0) {
    vec3 at = p + sunDir * 1.5 * sunTexel${receiver === "faces" ? " + n * sunTexel" : ""};
    lit = mix(sunMapLight(sunMap, sunMatrix, at), 1.0, fade);
  }
  if (dynamicFade < 1.0) {
    float moving = ${DYNAMIC_LIGHT[receiver]};
    lit = min(lit, mix(moving, 1.0, dynamicFade));
  }
  return mix(sunShade, vec3(1.0), lit);
}
`;
};

/** The `image` receiver's `sunLightAt`, for shaders that work out their own
 * positions (vehicle images, whose pixels carry a depth). They declare
 * `sunOrigin` and take the rest of `SunUniforms` as they are. */
export const SUN_IMAGE_LIGHT = SUN_LIGHT("image");

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
uniform vec2 groundPixelNdc;
varying vec2 vGroundTexel;
varying float vGroundShade;
varying vec3 vGroundPage;
varying vec3 vGroundClip;
flat varying vec3 vGroundAxisU;
flat varying vec3 vGroundAxisV;
vec3 groundAt(vec2 texel) {
  texel = clamp(texel, vec2(0.5), vec2(${CHUNK_SIZE_PX}.0 - 0.5));
  // Pages store their rows bottom first.
  vec2 at = vGroundPage.xy + vec2(texel.x, ${CHUNK_SIZE_PX}.0 - texel.y);
  vec3 uvw = vec3(at / vec2(textureSize(groundAtlas, 0).xy), floor(vGroundPage.z + 0.5));
  // Pages hold display-encoded bytes; the scene shades in linear light. Raised
  // ground darkens in display space, as the fixed view's overlays do.
  vec4 art = textureLod(groundAtlas, uvw, 0.0);
  return sRGBTransferEOTF(vec4(art.rgb * vGroundShade, art.a)).rgb;
}
vec3 groundArt() {
  if (groundNearest) return groundAt(vGroundTexel);
  // Project the face's texture axes at this fragment and invert the result
  // to get texels per screen pixel. Fragment derivatives can spike when a GPU
  // quad straddles chunk edges, which sends filter taps far across the page.
  vec2 ndc = vGroundClip.xy / vGroundClip.z;
  vec2 u = vGroundAxisU.xy - ndc * vGroundAxisU.z;
  vec2 v = vGroundAxisV.xy - ndc * vGroundAxisV.z;
  float det = u.x * v.y - u.y * v.x;
  if (abs(det) < 1e-8) return groundAt(vGroundTexel);
  vec2 scale = groundPixelNdc * (vGroundClip.z / det);
  vec2 dx = vec2(v.y, -u.y) * scale.x;
  vec2 dy = vec2(-v.x, u.x) * scale.y;
  #ifdef GROUND_CLIFF
    // Cliff artwork repeats one row up the face.
    dx.y = dy.y = 0.0;
  #endif
  vec3 sum = vec3(0.0);
  ${GROUND_TAPS.map(([x, y]) => `sum += groundAt(vGroundTexel + ${x.toFixed(4)} * dx + ${y.toFixed(4)} * dy);`).join("\n  ")}
  return sum / ${GROUND_TAPS.length}.0;
}
`;

/** A card's artwork: `cardPage` is its place in the page atlas (texel x, texel y,
 * layer). Alpha is the artwork's own, for the material's alpha test. */
const CARD_ART_FRAGMENT = `
uniform highp sampler2DArray cardAtlas;
varying vec3 vCardPage;
vec4 cardArt() {
  vec3 uvw = vec3(vCardPage.xy / vec2(textureSize(cardAtlas, 0).xy), floor(vCardPage.z + 0.5));
  // Pages hold display-encoded bytes; the scene shades in linear light.
  return sRGBTransferEOTF(textureLod(cardAtlas, uvw, 0.0));
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
    `fp:${card ? "card" : ""}:${sun?.receiver ?? ""}:${ground ? `ground-${ground.surface}` : ""}:${cardArt ? "art" : ""}`;
  const groundPixelNdc = ground && { value: new THREE.Vector2() };
  if (groundPixelNdc) {
    const viewport = new THREE.Vector4();
    // Three sets the viewport before drawing each eye of an XR view.
    material.onBeforeRender = (renderer) => {
      renderer.getCurrentViewport(viewport);
      groundPixelNdc.value.set(2 / viewport.z, 2 / viewport.w);
    };
  }
  material.onBeforeCompile = (shader) => {
    let vertex = shader.vertexShader;
    let fragment = shader.fragmentShader;
    const declare: string[] = [];
    if (cardArt) {
      shader.uniforms.cardAtlas = cardArt;
      declare.push("attribute vec3 cardPage;", "varying vec3 vCardPage;");
      vertex = vertex.replace(
        "#include <color_vertex>",
        "#include <color_vertex>\n  vCardPage = cardPage;",
      );
      fragment = fragment
        .replace("#include <common>", `#include <common>${CARD_ART_FRAGMENT}`)
        .replace("#include <map_fragment>", "diffuseColor *= cardArt();");
    }
    if (ground && groundPixelNdc) {
      shader.uniforms.groundAtlas = ground.atlas;
      shader.uniforms.groundNearest = GROUND_NEAREST;
      shader.uniforms.groundPixelNdc = groundPixelNdc;
      declare.push(
        "attribute vec2 groundTexel;",
        "attribute float groundShade;",
        "attribute vec3 groundPage;",
        "varying vec2 vGroundTexel;",
        "varying float vGroundShade;",
        "varying vec3 vGroundPage;",
        "varying vec3 vGroundClip;",
        "flat varying vec3 vGroundAxisU;",
        "flat varying vec3 vGroundAxisV;",
      );
      vertex = vertex
        .replace(
          "#include <color_vertex>",
          `#include <color_vertex>
  vGroundTexel = groundTexel;
  vGroundShade = groundShade;
  vGroundPage = groundPage;`,
        )
        .replace(
          "#include <project_vertex>",
          `#include <project_vertex>
  vGroundClip = gl_Position.xyw;
  vGroundAxisU = (projectionMatrix * modelViewMatrix[0]).xyw;
  vGroundAxisV = (projectionMatrix * modelViewMatrix[${ground.surface === "top" ? 1 : 2}]).xyw;`,
        );
      fragment = fragment
        .replace(
          "#include <common>",
          `#include <common>\n${ground.surface === "cliff" ? "#define GROUND_CLIFF" : ""}${GROUND_FRAGMENT}`,
        )
        .replace(
          "#include <color_fragment>",
          `if (vGroundPage.z > -0.5 && vGroundTexel.x > -0.5)
    diffuseColor.rgb = groundArt();
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
      if (sun.receiver === "card" || sun.receiver === "actor")
        declare.push("uniform vec3 sunDir;", "varying float vSunLift;");
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
    sun.receiver === "card"
      ? `vSunLift = abs(corner.x) + 2.0;
  vSunLocal.xy += normalize(sunDir.xy) * vSunLift;`
      : sun.receiver === "actor"
        ? // How far behind its sun-facing card the vertex stands (`cardRight` is in
          // game axes, `sunDir` in the scene's), and a pixel to clear the card.
          "vSunLift = max(0.0, -corner.x * dot(vec2(cardRight.x, -cardRight.y), normalize(sunDir.xy))) + 1.0;"
        : ""
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
