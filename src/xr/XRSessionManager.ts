/// <reference path="./webxr-layers.d.ts" />

import type { GameLoop } from "../core/GameLoop.js";
import type { Movement } from "../input/ActionManager.js";

/** Virtual screen width in meters. */
const SCREEN_WIDTH_M = 2.0;
/** Distance from the user in meters. */
const SCREEN_DISTANCE_M = 2.5;
/** Screen centre height above floor in meters (roughly seated eye height). */
const SCREEN_HEIGHT_M = 1.2;
/** Thumbstick dead zone. */
const DEAD_ZONE = 0.15;
/** How often (in frames) to log XR input diagnostics. */
const LOG_INTERVAL = 120;

const VERT_SRC = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  // flip Y so canvas top-left maps to texture top-left
  v_uv = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
}`;

const FRAG_SRC = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
out vec4 fragColor;
void main() {
  fragColor = texture(u_tex, v_uv);
}`;

/**
 * Manages a WebXR immersive-vr session that displays the game canvas on a
 * QuadLayer and exposes Quest Touch controller input via the Gamepad interface.
 */
export class XRSessionManager {
  private session: XRSession | null = null;
  private gameCanvas: HTMLCanvasElement | null = null;
  private gameLoop: GameLoop | null = null;
  private savedCanvasDisplay = "";

  // Blit pipeline
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private canvasTex: WebGLTexture | null = null;
  private fb: WebGLFramebuffer | null = null;

  /** Latest controller input — polled by GamepadPoller each game tick. */
  movement: Movement = { dx: 0, dy: 0, sprinting: false, jump: false };
  /** True when the throw button (right trigger) is held. */
  throwHeld = false;
  /** True while an immersive session is running. */
  active = false;
  onSessionEnd: (() => void) | null = null;

  private frameCount = 0;

  // ── feature detection ──────────────────────────────────────────────

  static async isSupported(): Promise<boolean> {
    if (!navigator.xr) return false;
    try {
      return await navigator.xr.isSessionSupported("immersive-vr");
    } catch {
      return false;
    }
  }

  // ── enter / exit ───────────────────────────────────────────────────

  async enterVR(gameCanvas: HTMLCanvasElement, gameLoop?: GameLoop): Promise<void> {
    if (!navigator.xr) throw new Error("WebXR not available");

    const glCanvas = document.createElement("canvas");
    const gl = glCanvas.getContext("webgl2", { xrCompatible: true });
    if (!gl) throw new Error("WebGL2 not available");
    this.gameCanvas = gameCanvas;

    // Hide the DOM canvas so the browser doesn't composite it behind the VR view
    this.savedCanvasDisplay = gameCanvas.style.visibility;
    gameCanvas.style.visibility = "hidden";

    const session = await navigator.xr.requestSession("immersive-vr", {
      requiredFeatures: ["local-floor"],
      optionalFeatures: ["layers"],
    });
    this.session = session;
    this.active = true;
    this.frameCount = 0;

    // Take over the game loop — page rAF is paused/throttled during immersive mode
    if (gameLoop) {
      gameLoop.stop();
      this.gameLoop = gameLoop;
    }

    session.addEventListener("end", () => this.cleanup());

    // Log when input sources change (controllers connect/disconnect)
    session.addEventListener("inputsourceschange", (ev: Event) => {
      const e = ev as XRInputSourcesChangeEvent;
      console.log(
        "[tilefun:xr] inputsourceschange — added:",
        e.added.length,
        "removed:",
        e.removed.length,
        "total:",
        session.inputSources.length,
      );
      for (const src of session.inputSources) {
        console.log(
          `[tilefun:xr]   source: handedness=${src.handedness} targetRayMode=${src.targetRayMode} profiles=${src.profiles.join(",")} hasGamepad=${!!src.gamepad}`,
        );
        if (src.gamepad) {
          console.log(
            `[tilefun:xr]   gamepad: axes=[${src.gamepad.axes.map((a) => a?.toFixed(2)).join(",")}] buttons=${src.gamepad.buttons.length}`,
          );
        }
      }
    });

    // Log initial input sources
    console.log("[tilefun:xr] Initial inputSources:", session.inputSources.length);
    for (const src of session.inputSources) {
      console.log(
        `[tilefun:xr]   source: handedness=${src.handedness} targetRayMode=${src.targetRayMode} profiles=${src.profiles.join(",")} hasGamepad=${!!src.gamepad}`,
      );
    }

    const refSpace = await session.requestReferenceSpace("local-floor");
    const binding = new XRWebGLBinding(session, gl);

    const aspect = gameCanvas.width / Math.max(gameCanvas.height, 1);
    const quadH = SCREEN_WIDTH_M / aspect;

    const quadLayer = binding.createQuadLayer({
      space: refSpace,
      viewPixelWidth: gameCanvas.width,
      viewPixelHeight: gameCanvas.height,
      width: SCREEN_WIDTH_M,
      height: quadH,
      layout: "mono",
      transform: new XRRigidTransform(
        { x: 0, y: SCREEN_HEIGHT_M, z: -SCREEN_DISTANCE_M, w: 1 },
        { x: 0, y: 0, z: 0, w: 1 },
      ),
    });

    session.updateRenderState({ layers: [quadLayer] });

    this.initBlit(gl);

    const onFrame = (time: DOMHighResTimeStamp, frame: XRFrame) => {
      if (!this.session) return;
      this.session.requestAnimationFrame(onFrame);
      this.readInput();
      // Drive the game loop from XR rAF (page rAF is paused in immersive mode)
      this.gameLoop?.externalTick(time);
      const sub = binding.getSubImage(quadLayer, frame);
      this.blit(gl, sub);
    };

    session.requestAnimationFrame(onFrame);
  }

  exitVR(): void {
    this.session?.end();
  }

  // ── input ──────────────────────────────────────────────────────────

  private readInput(): void {
    if (!this.session) return;

    this.frameCount++;

    let dx = 0;
    let dy = 0;
    let sprinting = false;
    let jump = false;
    let throwHeld = false;
    const debugParts: string[] = [];
    debugParts.push(`sources: ${this.session.inputSources.length}`);

    for (const src of this.session.inputSources) {
      const gp = src.gamepad;
      const hand = src.handedness;

      if (!gp) {
        debugParts.push(`${hand}: no gamepad`);
        continue;
      }

      const axesStr = gp.axes.map((a) => (a ?? 0).toFixed(2)).join(",");
      const btnsStr = gp.buttons
        .map((b, i) => (b?.pressed ? `B${i}` : ""))
        .filter(Boolean)
        .join("+");
      debugParts.push(`${hand}: axes=[${axesStr}] ${btnsStr || "(no btns)"}`);

      if (hand === "left" || (hand !== "right" && dx === 0 && dy === 0)) {
        // Try all common axis layouts: xr-standard [2,3], fallback [0,1]
        for (const [xi, yi] of [
          [2, 3],
          [0, 1],
        ] as const) {
          const rawX = gp.axes[xi] ?? 0;
          const rawY = gp.axes[yi] ?? 0;
          if (Math.abs(rawX) > DEAD_ZONE || Math.abs(rawY) > DEAD_ZONE) {
            dx = Math.abs(rawX) > DEAD_ZONE ? rawX : 0;
            dy = Math.abs(rawY) > DEAD_ZONE ? rawY : 0;
            break;
          }
        }
        const mag = Math.hypot(dx, dy);
        if (mag > 1) {
          dx /= mag;
          dy /= mag;
        }
      }

      if (hand === "right" || (hand !== "left" && !sprinting && !jump)) {
        // xr-standard: [4]=A, [5]=B, [0]=trigger
        sprinting = gp.buttons[4]?.pressed ?? false;
        jump = gp.buttons[5]?.pressed ?? false;
        throwHeld = gp.buttons[0]?.pressed ?? false;
      }
    }

    // Periodic logging
    if (this.frameCount % LOG_INTERVAL === 1) {
      const debugInfo = debugParts.join(" | ");
      console.log(`[tilefun:xr] frame ${this.frameCount}: ${debugInfo}`);
    }

    this.movement = { dx, dy, sprinting, jump };
    this.throwHeld = throwHeld;
  }

  // ── WebGL blit pipeline ────────────────────────────────────────────

  private initBlit(gl: WebGL2RenderingContext): void {
    const nn = <T>(v: T | null, label: string): T => {
      if (v === null) throw new Error(`WebGL ${label} creation failed`);
      return v;
    };

    const vs = nn(gl.createShader(gl.VERTEX_SHADER), "vertex shader");
    gl.shaderSource(vs, VERT_SRC);
    gl.compileShader(vs);

    const fs = nn(gl.createShader(gl.FRAGMENT_SHADER), "fragment shader");
    gl.shaderSource(fs, FRAG_SRC);
    gl.compileShader(fs);

    const prog = nn(gl.createProgram(), "program");
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    this.program = prog;

    // Fullscreen quad
    const vao = nn(gl.createVertexArray(), "VAO");
    gl.bindVertexArray(vao);
    const buf = nn(gl.createBuffer(), "buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    // prettier-ignore
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.vao = vao;

    // Texture for the game canvas
    const tex = nn(gl.createTexture(), "texture");
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.canvasTex = tex;

    this.fb = nn(gl.createFramebuffer(), "framebuffer");
  }

  private blit(gl: WebGL2RenderingContext, sub: XRWebGLSubImage): void {
    if (!this.gameCanvas) return;
    // Upload current game frame
    gl.bindTexture(gl.TEXTURE_2D, this.canvasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.gameCanvas);

    // Render into the QuadLayer's texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      sub.colorTexture,
      0,
    );
    gl.viewport(sub.viewport.x, sub.viewport.y, sub.viewport.width, sub.viewport.height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // ── cleanup ────────────────────────────────────────────────────────

  private cleanup(): void {
    // Restore canvas visibility
    if (this.gameCanvas) {
      this.gameCanvas.style.visibility = this.savedCanvasDisplay;
    }
    // Resume normal rAF-driven game loop
    if (this.gameLoop) {
      this.gameLoop.start();
      this.gameLoop = null;
    }
    this.active = false;
    this.session = null;
    this.movement = { dx: 0, dy: 0, sprinting: false, jump: false };
    this.throwHeld = false;
    this.program = null;
    this.vao = null;
    this.canvasTex = null;
    this.fb = null;
    this.gameCanvas = null;
    this.onSessionEnd?.();
  }
}
