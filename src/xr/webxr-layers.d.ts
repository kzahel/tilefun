/** Minimal type declarations for WebXR Layers API (not yet in TypeScript's lib.dom). */

interface XRWebGLBinding {
  createQuadLayer(init: {
    space: XRSpace;
    viewPixelWidth: number;
    viewPixelHeight: number;
    width?: number;
    height?: number;
    transform?: XRRigidTransform;
    layout?: "default" | "mono" | "stereo" | "stereo-left-right" | "stereo-top-bottom";
  }): XRQuadLayer;

  getSubImage(layer: XRQuadLayer, frame: XRFrame): XRWebGLSubImage;
}

declare const XRWebGLBinding: {
  prototype: XRWebGLBinding;
  new (session: XRSession, context: WebGL2RenderingContext): XRWebGLBinding;
};

interface XRQuadLayer extends EventTarget {
  readonly layout: string;
  width: number;
  height: number;
  transform: XRRigidTransform;
  needsRedraw: boolean;
  onredraw: ((event: Event) => void) | null;
}

interface XRWebGLSubImage {
  readonly colorTexture: WebGLTexture;
  readonly viewport: { x: number; y: number; width: number; height: number };
}

interface XRRenderStateInit {
  layers?: XRQuadLayer[];
}
