/** Native pixel pass for an already rendered RGBA asset, before nearest upscaling. */
export async function pixelOutline(canvas) {
  const fragment = await fetch(new URL("./pixel-outline.frag", import.meta.url)).then(
    (response) => {
      if (!response.ok) throw new Error("Missing pixel outline shader");
      return response.text();
    },
  );
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) throw new Error("WebGL2 is unavailable");
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(error);
    }
    return shader;
  }
  const vertex = compile(
    gl.VERTEX_SHADER,
    `#version 300 es
    void main() {
      vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
      gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
    }`,
  );
  const shader = compile(gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, shader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program));
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const locations = Object.fromEntries(
    ["painted", "imageSize", "outlineMode", "inkColor"].map((name) => [
      name,
      gl.getUniformLocation(program, name),
    ]),
  );
  let disposed = false;
  return {
    render(width, height, rgba, mode = "inner", color = [58, 58, 80]) {
      if (disposed) throw new Error("Pixel pass has been disposed");
      if (!["off", "inner", "outer"].includes(mode)) throw new Error("Invalid outline mode");
      if (rgba.length !== width * height * 4) throw new Error("Native RGBA dimensions differ");
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      // biome-ignore lint/correctness/useHookAtTopLevel: WebGL API, not a React hook.
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      gl.uniform1i(locations.painted, 0);
      gl.uniform2i(locations.imageSize, width, height);
      gl.uniform1i(locations.outlineMode, ["off", "inner", "outer"].indexOf(mode));
      gl.uniform3fv(
        locations.inkColor,
        color.map((value) => value / 255),
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (gl.getError() !== gl.NO_ERROR) throw new Error("Pixel pass GL error");
    },
    read() {
      const width = canvas.width,
        height = canvas.height;
      const raw = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw);
      const upright = new Uint8Array(raw.length);
      for (let y = 0; y < height; y++)
        upright.set(raw.subarray(y * width * 4, (y + 1) * width * 4), (height - 1 - y) * width * 4);
      return upright;
    },
    dispose() {
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(shader);
      disposed = true;
    },
  };
}
