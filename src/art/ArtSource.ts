import type { ArtSheet } from "./ArtCatalog.js";

export async function sha256(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, "0")).join("");
}
/** Decode the exact bytes whose revision will be attached to an annotation. */
export async function loadVerifiedArtImage(sheet: ArtSheet): Promise<HTMLImageElement> {
  const response = await fetch(sheet.image);
  if (!response.ok) throw new Error(`Image server returned ${response.status}`);
  const bytes = await response.arrayBuffer();
  if ((await sha256(bytes)) !== sheet.fingerprint)
    throw new Error("Source image changed. Refresh the art inventory before annotating it.");
  const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth !== sheet.width || image.naturalHeight !== sheet.height)
      throw new Error("Source dimensions changed");
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
