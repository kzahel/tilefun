import * as THREE from "three";
import { headFromMatrix } from "../xr/XrRig.js";
import type { GpuRasterSurface } from "./GpuRasterSurface.js";
import type { ImmersiveOutput, ScreenOutput, View3dTarget, View3dXr } from "./View3dHost.js";

const clearColor = new THREE.Color();

/** `local-floor` where the headset has a floor; otherwise the head's start. */
async function roomSpace(session: XRSession): Promise<XRReferenceSpace> {
  try {
    return await session.requestReferenceSpace("local-floor");
  } catch {
    return session.requestReferenceSpace("local");
  }
}

/**
 * Headset sessions on the fixed view's renderer (252).
 *
 * Immersive output goes through three.js's XR manager, which owns the session's
 * frame loop, the eyes' cameras and the headset's render target. The manager
 * swaps the camera of every render while it is enabled, so it is enabled only
 * around the immersive draw: anything else the host draws in that frame keeps
 * its own camera.
 *
 * The headset screen does not use the manager: the page draws its canvas as on
 * any frame, and the canvas is copied into a quad layer.
 */
export function createXrHost(
  surface: GpuRasterSurface,
  target: (width: number, height: number) => View3dTarget,
  /** An immersive session ended and the renderer has its own size back: size it
   * to the page as the page is now. */
  restored: () => void,
): View3dXr {
  return {
    async immersive(session, frame): Promise<ImmersiveOutput> {
      const { renderer } = surface;
      const { xr } = renderer;
      surface.flush();
      // Not every headset has a floor; a session lists what it was given.
      const floor = session.enabledFeatures?.includes("local-floor") ?? true;
      xr.setReferenceSpaceType(floor ? "local-floor" : "local");
      xr.enabled = false;
      /** The headset's render target as the manager bound it for this frame. */
      let eyes: THREE.WebGLRenderTarget | null = null;
      // Sizes the renderer to the headset's eye buffers until the session ends.
      const started = xr.setSession(session);
      // Registered after the manager's own listener (added as `setSession` was
      // called), so this runs once it has put the renderer's size and target
      // back, whether the session presented or failed to start.
      session.addEventListener(
        "end",
        () => {
          // The manager's page loop would now idle with no callback: stop it.
          renderer.setAnimationLoop(null);
          xr.enabled = false;
          eyes = null;
          surface.pages.atlas.session = false;
          // A session that failed before it was sized puts no pixel ratio back.
          if (!renderer.getPixelRatio()) renderer.setPixelRatio(1);
          // The manager restored the size the session started at; the page may
          // have changed size meanwhile, and its resizes were held back.
          restored();
        },
        { once: true },
      );
      surface.pages.atlas.session = true;
      await started;
      const space = xr.getReferenceSpace() ?? (await roomSpace(session));
      xr.setAnimationLoop((time: number, xrFrame?: XRFrame) => {
        if (!xrFrame) return;
        eyes = renderer.getRenderTarget();
        frame(time, xrFrame);
        eyes = null;
      });
      return {
        space,
        draw(draw) {
          const bound = eyes as (THREE.WebGLRenderTarget & { isXRRenderTarget?: boolean }) | null;
          if (surface.disposed || surface.lost || !bound?.isXRRenderTarget) return false;
          surface.flush();
          const scissor = renderer.getScissorTest();
          const clearAlpha = renderer.getClearAlpha();
          renderer.getClearColor(clearColor);
          renderer.setRenderTarget(bound);
          renderer.setScissorTest(false);
          xr.enabled = true;
          try {
            // One eye's share of a side-by-side target.
            draw(target(Math.max(1, Math.round(bound.width / 2)), bound.height));
          } finally {
            xr.enabled = false;
            renderer.setScissorTest(scissor);
            renderer.setClearColor(clearColor, clearAlpha);
            renderer.setRenderTarget(bound);
          }
          return true;
        },
      };
    },

    async screen(session, frame, placement): Promise<ScreenOutput> {
      const { renderer, canvas } = surface;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      await gl.makeXRCompatible();
      const binding = new XRWebGLBinding(session, gl);
      const space = await roomSpace(session);
      const pixels = { width: canvas.width, height: canvas.height };
      const metres = placement.width;
      const layer = binding.createQuadLayer({
        space,
        viewPixelWidth: pixels.width,
        viewPixelHeight: pixels.height,
        layout: "mono",
        // Browsers read these as half the panel's size.
        width: metres / 2,
        height: (metres * pixels.height) / pixels.width / 2,
      });
      session.updateRenderState({ layers: [layer] });
      surface.pages.atlas.session = true;
      const copy = gl.createFramebuffer();
      let ended = false;
      let hung = false;
      // The headset's own recentre moves the room's origin: hang the panel again.
      space.addEventListener("reset", () => {
        hung = false;
      });
      const tick = (time: number, xrFrame: XRFrame) => {
        if (ended) return;
        session.requestAnimationFrame(tick);
        // The room's own origin and forward are wherever the headset last set
        // them: hang the panel in front of the head as the session finds it.
        const pose = hung ? null : xrFrame.getViewerPose(space);
        if (pose) {
          hung = true;
          const head = headFromMatrix(pose.transform.matrix);
          const half = -head.yaw / 2;
          layer.transform = new XRRigidTransform(
            {
              x: head.x + Math.sin(head.yaw) * placement.distance,
              y: head.y - placement.below,
              z: head.z - Math.cos(head.yaw) * placement.distance,
            },
            { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) },
          );
        }
        frame(time, xrFrame);
        if (surface.disposed || surface.lost) return;
        surface.flush();
        // The page's frame is on the canvas now; copy it to the panel.
        const image = binding.getSubImage(layer, xrFrame);
        const { x, y, width, height } = image.viewport;
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, copy);
        gl.framebufferTexture2D(
          gl.DRAW_FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          image.colorTexture,
          0,
        );
        gl.disable(gl.SCISSOR_TEST);
        gl.colorMask(true, true, true, true);
        const same = canvas.width === width && canvas.height === height;
        gl.blitFramebuffer(
          0,
          0,
          canvas.width,
          canvas.height,
          x,
          y,
          x + width,
          y + height,
          gl.COLOR_BUFFER_BIT,
          same ? gl.NEAREST : gl.LINEAR,
        );
        gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        // three.js caches the state changed above.
        renderer.resetState();
      };
      session.requestAnimationFrame(tick);
      session.addEventListener(
        "end",
        () => {
          ended = true;
          surface.pages.atlas.session = false;
          if (!surface.disposed && !surface.lost) gl.deleteFramebuffer(copy);
          renderer.resetState();
        },
        { once: true },
      );
      return { space };
    },
  };
}
