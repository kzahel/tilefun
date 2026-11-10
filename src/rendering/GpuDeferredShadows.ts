import * as THREE from "three";
import type { Camera } from "./Camera.js";
import type { GpuShadow } from "./GpuShadowShape.js";
import { projectWorld } from "./Projection.js";
import { WORLD_DEPTH_RANGE } from "./WorldDepth.js";

const FLOATS = 15;
const VERTEX = `#version 300 es
in vec2 corner; in vec4 rect; in vec4 shape; in vec4 inverse; in vec3 plane;
uniform vec2 target;
out vec4 vShape; out vec4 vInverse; out vec3 vPlane;
void main(){
  vec2 p=mix(rect.xy,rect.zw,corner);
  vShape=shape; vInverse=inverse; vPlane=plane;
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
in vec4 vShape; // centre x, centre y, band, mask
in vec4 vInverse; in vec3 vPlane;
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
  float limit=dot(vPlane.xy,vec2(wx,wy))+vPlane.z;
  if(z>limit||z<limit-vShape.z)discard;
  vec2 d=vec2(wx,wy)-vShape.xy, l=vec2(dot(vInverse.xy,d),dot(vInverse.zw,d));
  // The analytic forms of the projected decal masks ("oval", "vehicle").
  float a=vShape.w<.5?(1.-length(l))/.2:(.18-length(max(abs(l)-.72,0.)))/.12;
  a=clamp(a,0.,1.)*.28;
  if(a<=0.)discard;
  color=vec4(0.,0.,0.,a);
}`;

/** Actor ovals and vehicle footprints as one instanced draw over the finished
 * world (236). Each instance is a screen rectangle covering every height its
 * caster could shade; the fragment shader reconstructs the visible world point
 * from the world depth texture and applies the projected decal's soft mask. */
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
  /** Queue a caster for `target`, whose scene pass draws with the padded backend
   * camera and no other transform. False while the target has no sampleable
   * depth: the caller draws a plain shadow until the next frame. */
  queue(target: THREE.WebGLRenderTarget, camera: Camera, shadow: GpuShadow): boolean {
    this.requested = true;
    if (!target.depthTexture) return false;
    const { x, y, ux, uy, vx, vy, plane, band } = shadow,
      det = ux * vy - vx * uy,
      scale = camera.scale;
    if (scale <= 0 || Math.abs(det) < 1e-9) return true;
    const origin = projectWorld(camera, 0, 0, 0),
      view = this.view;
    view[0] = origin.sx;
    view[1] = origin.sy;
    view[2] = scale;
    view[3] = camera.y;
    if ((this.count + 1) * FLOATS > this.data.length) {
      const grown = new Float32Array(this.data.length * 2);
      grown.set(this.data);
      this.data = grown;
    }
    // A screen rectangle over every height the footprint may shade.
    const ex = Math.abs(ux) + Math.abs(vx),
      ey = Math.abs(uy) + Math.abs(vy),
      middle = plane[0] * x + plane[1] * y + plane[2],
      tilt = Math.abs(plane[0]) * ex + Math.abs(plane[1]) * ey;
    const out = this.data,
      i = this.count++ * FLOATS;
    out[i] = origin.sx + (x - ex) * scale - 1;
    out[i + 1] = origin.sy + (y - ey - middle - tilt) * scale - 1;
    out[i + 2] = origin.sx + (x + ex) * scale + 1;
    out[i + 3] = origin.sy + (y + ey - (middle - tilt - band)) * scale + 1;
    out[i + 4] = x;
    out[i + 5] = y;
    out[i + 6] = band;
    out[i + 7] = shadow.mask === "vehicle" ? 1 : 0;
    out[i + 8] = vy / det;
    out[i + 9] = -vx / det;
    out[i + 10] = -uy / det;
    out[i + 11] = ux / det;
    out[i + 12] = plane[0];
    out[i + 13] = plane[1];
    out[i + 14] = plane[2];
    return true;
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
    for (const [index, name] of ["corner", "rect", "shape", "inverse", "plane"].entries())
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
      [3, 4, 32],
      [4, 3, 48],
    ] as const) {
      gl.enableVertexAttribArray(index);
      gl.vertexAttribPointer(index, size, gl.FLOAT, false, stride, offset);
      gl.vertexAttribDivisor(index, 1);
    }
    gl.bindVertexArray(null);
    this.framebuffer = gl.createFramebuffer();
  }
}
