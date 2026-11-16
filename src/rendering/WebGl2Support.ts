/** Tilefun renders the world only through WebGL2 (232); there is no Canvas fallback. */
export class WebGl2UnavailableError extends Error {
  override readonly name = "WebGl2Unavailable";
  /** Pages show `String(error)`; a child-facing screen gets the message alone. */
  override toString() {
    return this.message;
  }
  constructor(cause?: unknown) {
    super(
      "Tilefun needs WebGL2. Turn on hardware acceleration in your browser settings, or use a current Chrome, Edge, Firefox or Safari.",
      { cause },
    );
  }
}

let confirmed = false;
let software = false;

/** True when the WebGL2 probe found a software rasteriser (SwiftShader,
 * llvmpipe, a basic display driver): the GPU's work runs on the CPU. */
export function softwareWebGl(): boolean {
  return software;
}

/** A renderer string naming a software rasteriser. */
export function isSoftwareRenderer(renderer: string): boolean {
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
}

/** Fail before profiles or worlds open when the browser cannot create a WebGL2
 * context. The probe context is released immediately; a success is remembered so
 * lab scene changes do not probe again. */
export function requireWebGl2(create = () => document.createElement("canvas")): void {
  if (confirmed) return;
  let context: WebGL2RenderingContext | null = null;
  try {
    context = create().getContext("webgl2");
  } catch (error) {
    throw new WebGl2UnavailableError(error);
  }
  if (!context) throw new WebGl2UnavailableError();
  const info = context.getExtension("WEBGL_debug_renderer_info");
  const renderer = context.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : context.RENDERER);
  software = typeof renderer === "string" && isSoftwareRenderer(renderer);
  context.getExtension("WEBGL_lose_context")?.loseContext();
  confirmed = true;
}
