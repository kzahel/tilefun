/** Load an image from the given URL, pre-decoded to avoid render-time stalls. */
export async function loadImage(url: string): Promise<ImageBitmap> {
  const img = new Image();
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
  });
  return createImageBitmap(img);
}

/** Load and parse JSON from the given URL. */
export function loadJSON<T>(url: string): Promise<T> {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Failed to load JSON: ${url} (${res.status})`);
    return res.json() as Promise<T>;
  });
}
