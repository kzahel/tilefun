/** Offline diagnostic only: test the portable car material/geometry path through
 * Three's WebGPU renderer and its WebGL2 fallback. Not the gameplay sprite shader.
 */
export async function probeWebGpuAsset(forceWebGL: boolean) {
  const THREE = await import("three/webgpu");
  const { loadCarMesh } = await import("./CarMeshAsset.js");
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 192;
  const renderer = new THREE.WebGPURenderer({ canvas, forceWebGL, antialias: false });
  const target = new THREE.RenderTarget(192, 192);
  target.texture.colorSpace = THREE.SRGBColorSpace;
  let asset: Awaited<ReturnType<typeof loadCarMesh>> | undefined;
  const started = performance.now();
  try {
    await renderer.init();
    const initialized = performance.now();
    asset = await loadCarMesh();
    const loaded = performance.now();
    const scene = new THREE.Scene(),
      camera = new THREE.Camera();
    camera.coordinateSystem = renderer.coordinateSystem;
    scene.add(asset.object);
    asset.object.rotation.z = Math.PI;
    camera.projectionMatrix.set(
      1 / 64,
      0,
      0,
      0,
      0,
      -1 / 64,
      1 / 64,
      0,
      0,
      -1 / 256,
      -1 / 256,
      renderer.coordinateSystem === THREE.WebGPUCoordinateSystem ? 0.5 : 0,
      0,
      0,
      0,
      1,
    );
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    renderer.setSize(192, 192, false);
    renderer.setClearColor(0x243245, 1);
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 192, 192);
    const finished = performance.now();
    let colored = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i] !== pixels[0] || pixels[i + 1] !== pixels[1] || pixels[i + 2] !== pixels[2])
        colored++;
    return {
      requested: forceWebGL ? "webgl2" : "webgpu",
      backend:
        "isWebGPUBackend" in renderer.backend && renderer.backend.isWebGPUBackend
          ? "WebGPUBackend"
          : "isWebGLBackend" in renderer.backend && renderer.backend.isWebGLBackend
            ? "WebGLBackend"
            : "unknown",
      initializationMs: initialized - started,
      assetLoadMs: loaded - initialized,
      firstRenderAndReadbackMs: finished - loaded,
      coloredPixels: colored,
    };
  } finally {
    asset?.dispose();
    target.dispose();
    renderer.dispose();
  }
}
