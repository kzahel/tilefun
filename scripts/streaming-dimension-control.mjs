// Benchmark-only counterfactual: retain the same source, shader and draw order,
// but route decoded images through the existing uncached dimension lookup.
export function disableImageDimensionCache(source) {
  const branch = "if (image instanceof ImageBitmap || image instanceof HTMLImageElement) {";
  if (source.split(branch).length !== 2)
    throw Error("GPU dimension control no longer matches the renderer; update the benchmark");
  return source.replace(branch, "if (false) {");
}
