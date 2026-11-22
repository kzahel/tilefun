import * as THREE from "three";
import { type Atmosphere, atmosphereShows } from "../../sky/Atmosphere.js";

/** Lanterns one view lights; more are left dark. */
export const MAX_VIEW_LIGHTS = 4;
/** Rain's clock wraps here; every streak and splash rate times it is whole. */
const RAIN_LOOP_SECONDS = 600;

// One triangle over the view, whatever camera draws it (a headset's eyes too).
const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Sunlight: the view is multiplied by the tint, less so around lanterns.
const TINT = `
uniform vec3 tint;
uniform vec2 size;
uniform float glow;
uniform vec4 lights[${MAX_VIEW_LIGHTS}];
varying vec2 vUv;
void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * size;
  float lit = 0.0;
  for (int i = 0; i < ${MAX_VIEW_LIGHTS}; i++) {
    float reach = distance(p, lights[i].xy) / max(lights[i].z, 1.0);
    lit = max(lit, lights[i].w * (1.0 - smoothstep(0.15, 1.0, reach)));
  }
  vec3 lantern = max(tint, vec3(1.0, 0.94, 0.8));
  gl_FragColor = vec4(mix(tint, lantern, lit * glow), 1.0);
}`;

// Rain and lightning over it. Top-down, streaks and splashes keep their place
// on the ground as the camera moves; first person has streaks only.
const WEATHER = `
uniform vec2 size;
uniform vec2 origin;
uniform float scale;
uniform float time;
uniform float rain;
uniform float flash;
uniform float ground;
varying vec2 vUv;
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float streaks(vec2 p, float cell, float len, float speed, float density) {
  p.x += p.y * 0.2;
  float column = floor(p.x / cell);
  float fall = p.y / len - time * speed - hash(vec2(column, 7.0)) * 31.0;
  float row = floor(fall);
  float along = fall - row;
  float on = step(1.0 - density, hash(vec2(column, row)));
  float across = fract(p.x / cell) - (0.2 + 0.6 * hash(vec2(row, column)));
  float line = 1.0 - smoothstep(0.3 / cell, 0.8 / cell, abs(across));
  return on * line * smoothstep(0.0, 0.4, along) * (1.0 - step(0.45, along));
}
float splashes(vec2 p, float cell, float density) {
  vec2 grid = p / cell;
  vec2 id = floor(grid);
  float beat = time * 1.5 + hash(id) * 10.0;
  float slot = floor(beat);
  float age = beat - slot;
  vec2 centre = 0.2 + 0.6 * vec2(hash(id + slot), hash(id - slot * 1.7));
  vec2 away = (fract(grid) - centre) * cell;
  // Rings lie on the ground, seen from above the south.
  float reach = length(vec2(away.x, away.y * 1.6));
  float ring = 1.0 - smoothstep(0.0, 0.7, abs(reach - (0.5 + 3.0 * age)));
  return ring * (1.0 - age) * step(1.0 - density, hash(id + slot + 3.1));
}
void main() {
  vec2 pixel = vec2(vUv.x, 1.0 - vUv.y) * size;
  // Rain keeps its size on screen when the view zooms out past one to one.
  float zoom = max(scale, 1.0);
  vec2 p = pixel / zoom + origin * (scale / zoom);
  float drops =
    streaks(p, 9.0, 46.0, 3.5, 0.2 + 0.5 * rain) * 0.5 +
    streaks(p * 1.7 + 31.0, 9.0, 40.0, 2.5, 0.15 + 0.45 * rain) * 0.28;
  drops += ground * splashes(p, 18.0, 0.25 + 0.6 * rain) * 0.4;
  float wet = clamp(rain * 4.0, 0.0, 1.0);
  float water = clamp(drops * wet + 0.07 * rain, 0.0, 1.0);
  float light = flash * 0.42;
  gl_FragColor = vec4(
    vec3(0.8, 0.88, 1.0) * water * (1.0 - light) + vec3(light),
    1.0 - (1.0 - water) * (1.0 - light)
  );
}`;

/**
 * The sky over a drawn view: sunlight's tint by multiplication, then rain and
 * lightning. Two triangles after everything else, and nothing on a clear day.
 */
export class FirstPersonAtmosphere {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly geometry = new THREE.BufferGeometry();
  private readonly tint = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: TINT,
    uniforms: {
      tint: { value: new THREE.Vector3(1, 1, 1) },
      size: { value: new THREE.Vector2(1, 1) },
      glow: { value: 0 },
      lights: {
        value: Array.from({ length: MAX_VIEW_LIGHTS }, () => new THREE.Vector4(0, 0, 1, 0)),
      },
    },
    ...OVER_THE_VIEW,
    blending: THREE.CustomBlending,
    blendSrc: THREE.DstColorFactor,
    blendDst: THREE.ZeroFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
  private readonly weather = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: WEATHER,
    uniforms: {
      size: { value: new THREE.Vector2(1, 1) },
      origin: { value: new THREE.Vector2(0, 0) },
      scale: { value: 1 },
      time: { value: 0 },
      rain: { value: 0 },
      flash: { value: 0 },
      ground: { value: 0 },
    },
    ...OVER_THE_VIEW,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
  private readonly tintMesh = new THREE.Mesh(this.geometry, this.tint);
  private readonly weatherMesh = new THREE.Mesh(this.geometry, this.weather);
  /** Whether the last frame drew any of it. */
  drawn = false;

  constructor() {
    this.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
    );
    for (const [order, mesh] of [this.tintMesh, this.weatherMesh].entries()) {
      mesh.frustumCulled = false;
      mesh.renderOrder = order;
      this.scene.add(mesh);
    }
  }

  /**
   * Over a view already drawn. `scale` is the top-down camera's, centred on the
   * eye; first person has none.
   */
  draw(
    renderer: THREE.WebGLRenderer,
    atmosphere: Atmosphere | undefined,
    { width, height }: { readonly width: number; readonly height: number },
    eye: { readonly x: number; readonly y: number },
    scale: number | undefined,
  ): void {
    this.drawn = !!atmosphere && atmosphereShows(atmosphere);
    if (!atmosphere || !this.drawn) return;
    const tint = this.tint.uniforms as TintUniforms;
    tint.tint.value.set(...atmosphere.tint);
    tint.size.value.set(width, height);
    tint.glow.value = atmosphere.glow;
    for (const [index, light] of tint.lights.value.entries()) {
      const from = atmosphere.lights?.[index];
      if (from) light.set(from.x, from.y, from.radius, 1);
      else light.set(0, 0, 1, 0);
    }
    const weather = this.weather.uniforms as WeatherUniforms;
    this.weatherMesh.visible = atmosphere.rain > 0.001 || atmosphere.flash > 0.001;
    weather.size.value.set(width, height);
    weather.scale.value = scale ?? 1;
    if (scale) weather.origin.value.set(eye.x - width / 2 / scale, eye.y - height / 2 / scale);
    else weather.origin.value.set(0, 0);
    weather.time.value = (atmosphere.seconds ?? 0) % RAIN_LOOP_SECONDS;
    weather.rain.value = atmosphere.rain;
    weather.flash.value = atmosphere.flash;
    weather.ground.value = scale ? 1 : 0;
    renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.geometry.dispose();
    this.tint.dispose();
    this.weather.dispose();
  }
}

const OVER_THE_VIEW = {
  depthTest: false,
  depthWrite: false,
  fog: false,
  toneMapped: false,
  transparent: true,
} as const;

interface TintUniforms {
  tint: { value: THREE.Vector3 };
  size: { value: THREE.Vector2 };
  glow: { value: number };
  lights: { value: THREE.Vector4[] };
  [name: string]: THREE.IUniform;
}
interface WeatherUniforms {
  size: { value: THREE.Vector2 };
  origin: { value: THREE.Vector2 };
  scale: { value: number };
  time: { value: number };
  rain: { value: number };
  flash: { value: number };
  ground: { value: number };
  [name: string]: THREE.IUniform;
}
