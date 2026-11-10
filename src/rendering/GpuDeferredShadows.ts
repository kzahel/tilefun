import * as THREE from "three";
import type { Camera } from "./Camera.js";
import { projectWorld } from "./Projection.js";
import type { SpriteItem } from "./SceneItem.js";
import { WORLD_DEPTH_RANGE } from "./WorldDepth.js";

const FLOATS = 10;
const VERTEX = `#version 300 es
in vec2 corner; in vec4 rect; in vec4 ellipse; in vec2 heights;
uniform vec2 target;
out vec4 vEllipse; out vec2 vHeights;
void main(){
  vec2 p=mix(rect.xy,rect.zw,corner);
  vEllipse=ellipse; vHeights=heights;
  gl_Position=vec4(p.x/target.x*2.-1.,1.-p.y/target.y*2.,0.,1.);
}`;
// World depth is 0.5-(wy+z-cameraY)/RANGE and screen y is scale*(wy-z)+originY, so a
// pixel and its depth give the visible point's wx, wy and z. Base terrain never
// writes depth: a cleared pixel is ground at z=0. Only upward-facing receivers take
// a shadow: along one screen column wy+z rises on floors, ramps and roofs and falls
// on upright sprites, so a caster never darkens its own or a neighbour's body.
const FRAGMENT = `#version 300 es
precision highp float;
uniform highp sampler2D depth;
uniform vec4 view; // origin x, origin y, scale, camera y
uniform vec2 target;
in vec4 vEllipse; in vec2 vHeights;
out vec4 color;
const float RANGE=${WORLD_DEPTH_RANGE}.;
vec2 along(ivec2 p){float d=texelFetch(depth,p,0).r;return vec2(view.w+(.5-d)*RANGE,d);}
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy);
  float across=(target.y-gl_FragCoord.y-view.y)/view.z; // wy-z
  float wx=(gl_FragCoord.x-view.x)/view.z, wy=across, z=0.;
  vec2 here=along(p);
  if(here.y<.99999){
    z=(here.x-across)*.5; wy=(here.x+across)*.5;
    // Mesh depth images are native world pixels: step at least one of them.
    int k=int(max(1.,ceil(view.z)));
    vec2 below=along(p-ivec2(0,k)), above=along(p+ivec2(0,k));
    float rate=view.z/float(k), down=(below.x-here.x)*rate, up=(here.x-above.x)*rate;
    if(!((below.y<.99999&&down>.2&&down<5.)||(above.y<.99999&&up>.2&&up<5.)))discard;
  }
  if(z>vHeights.x||z<vHeights.y)discard;
  float a=clamp((1.-length((vec2(wx,wy)-vEllipse.xy)/vEllipse.zw))/.2,0.,1.)*.28;
  if(a<=0.)discard;
  color=vec4(0.,0.,0.,a);
}`;

/** Actor oval shadows as one instanced draw over the finished world (236).
 * Each instance is a screen rectangle covering every height its caster could
 * shade; the fragment shader reconstructs the visible world point from the
 * world depth texture and applies the same soft oval as the CPU decal mask. */
export class GpuDeferredShadows {
  private data = new Float32Array(FLOATS * 256);
  private count = 0;
  private readonly view = [0, 0, 1, 0];
  private gl: WebGL2RenderingContext | undefined;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffer: WebGLBuffer | null = null;
  private capacity = 0;
  private requested = false;
  private framebuffer: WebGLFramebuffer | null = null;
  /** Shadows drawn in the last pass (diagnostics). */
  drawn = 0;

  get pending() {
    return this.count;
  }
  clear() {
    this.count = 0;
  }
  /** Context loss invalidates every GL object; the next draw rebuilds them. */
  reset() {
    this.count = 0;
    this.gl = undefined;
    this.program = this.vao = this.buffer = this.framebuffer = null;
    this.capacity = 0;
  }
  /** Between frames: give `target` a sampleable depth texture once a shadow has
   * asked for it. The default renderbuffer stays for every other configuration. */
  prepare(target: THREE.WebGLRenderTarget | undefined) {
    if (!this.requested || !target || target.depthTexture) return;
    target.depthTexture = new THREE.DepthTexture(target.width, target.height);
    target.dispose(); // reallocate attachments on the next render
  }
  /** Queue an actor's oval for `target`, whose scene pass draws with the padded
   * backend camera and no other transform. False while the target has no
   * sampleable depth: the caller draws a plain shadow until the next frame. */
  queue(
    target: THREE.WebGLRenderTarget,
    camera: Camera,
    shadow: NonNullable<SpriteItem["gpuShadow"]>,
  ): boolean {
    this.requested = true;
    if (!target.depthTexture) return false;
    const origin = projectWorld(camera, 0, 0, 0),
      // A slope raises or lowers the receiver within the footprint; upright
      // bodies are rejected by facing, so this allowance never darkens a sprite.
      slack = 2 + Math.max(shadow.rx, shadow.ry) * 0.6;
    this.add(
      origin.sx,
      origin.sy,
      camera.scale,
      camera.y,
      shadow.x,
      shadow.y,
      shadow.rx,
      shadow.ry,
      shadow.z + slack,
      shadow.z - slack,
    );
    return true;
  }
  /** Queue one oval. Screen values are final target pixels (y down); the rest is
   * world pixels. `top`/`floor` bound the receiver heights the caster can shade. */
  private add(
    originX: number,
    originY: number,
    scale: number,
    cameraY: number,
    x: number,
    y: number,
    rx: number,
    ry: number,
    top: number,
    floor: number,
  ) {
    if (rx <= 0 || ry <= 0 || scale <= 0) return;
    const view = this.view;
    view[0] = originX;
    view[1] = originY;
    view[2] = scale;
    view[3] = cameraY;
    if ((this.count + 1) * FLOATS > this.data.length) {
      const grown = new Float32Array(this.data.length * 2);
      grown.set(this.data);
      this.data = grown;
    }
    const out = this.data,
      i = this.count++ * FLOATS;
    out[i] = originX + (x - rx) * scale - 1;
    out[i + 1] = originY + (y - ry - top) * scale - 1;
    out[i + 2] = originX + (x + rx) * scale + 1;
    out[i + 3] = originY + (y + ry - floor) * scale + 1;
    out[i + 4] = x;
    out[i + 5] = y;
    out[i + 6] = rx;
    out[i + 7] = ry;
    out[i + 8] = top;
    out[i + 9] = floor;
  }
  /** Blend the queued shadows into `target`'s colour, reading its depth texture.
   * Raw GL: the colour-only framebuffer keeps the sampled depth texture out of the
   * draw framebuffer (no feedback loop). The caller rebinds its render target. */
  draw(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget) {
    const count = this.count;
    this.count = 0;
    this.drawn = count;
    const depthTexture = target.depthTexture;
    if (!count || !depthTexture) return;
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const properties = renderer.properties as unknown as {
      get(texture: object): { __webglTexture?: WebGLTexture };
    };
    const color = properties.get(target.texture).__webglTexture,
      depth = properties.get(depthTexture).__webglTexture;
    if (!color || !depth) return;
    if (this.gl !== gl) this.build(gl);
    if (!this.program || !this.vao || !this.buffer || !this.framebuffer) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
    gl.viewport(0, 0, target.width, target.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(false);
    gl.colorMask(true, true, true, true);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    // Premultiplied black, composed exactly like the projected decal quads.
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram is not a React hook.
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, depth);
    gl.uniform1i(gl.getUniformLocation(this.program, "depth"), 0);
    gl.uniform4fv(gl.getUniformLocation(this.program, "view"), this.view);
    gl.uniform2f(gl.getUniformLocation(this.program, "target"), target.width, target.height);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const bytes = this.data.subarray(0, count * FLOATS);
    if (count > this.capacity) {
      this.capacity = this.data.length / FLOATS;
      gl.bufferData(gl.ARRAY_BUFFER, this.data, gl.DYNAMIC_DRAW);
    } else gl.bufferSubData(gl.ARRAY_BUFFER, 0, bytes);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.bindVertexArray(null);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    renderer.resetState();
  }
  private build(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.capacity = 0;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw Error("Shadow shader unavailable");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw Error(`Shadow shader: ${gl.getShaderInfoLog(shader)}`);
      return shader;
    };
    const program = gl.createProgram();
    if (!program) throw Error("Shadow program unavailable");
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    for (const [index, name] of ["corner", "rect", "ellipse", "heights"].entries())
      gl.bindAttribLocation(program, index, name);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw Error(`Shadow program: ${gl.getProgramInfoLog(program)}`);
    this.program = program;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const corners = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const stride = FLOATS * 4;
    for (const [index, size, offset] of [
      [1, 4, 0],
      [2, 4, 16],
      [3, 2, 32],
    ] as const) {
      gl.enableVertexAttribArray(index);
      gl.vertexAttribPointer(index, size, gl.FLOAT, false, stride, offset);
      gl.vertexAttribDivisor(index, 1);
    }
    gl.bindVertexArray(null);
    this.framebuffer = gl.createFramebuffer();
  }
}
