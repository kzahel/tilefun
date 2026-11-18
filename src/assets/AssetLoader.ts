import { STARTUP_ASSET_VERSION } from "../shared/startupAssetCache.js";

export let startupAssetCacheReady: Promise<void> | undefined;
let startupVersions: ReadonlyMap<string, string> | undefined;

/** Begin alongside the main module graph; only the Vite play page calls this. */
export function prepareStartupAssetCache(manifestUrl: string): void {
  startupAssetCacheReady ??= fetch(manifestUrl, {
    cache: "no-cache",
    signal: AbortSignal.timeout?.(8_000),
  })
    .then(async (res) => {
      if (res.ok)
        startupVersions = new Map(Object.entries((await res.json()) as Record<string, string>));
    })
    .catch(() => {
      // A missing manifest should leave normal asset loading available.
    });
}

function versionedUrl(path: string): string {
  const version = startupVersions?.get(path);
  return version ? `${path}?${STARTUP_ASSET_VERSION}=${version}` : path;
}

/** Load an image from the given URL, pre-decoded to avoid render-time stalls. */
export async function loadImage(url: string, options?: ImageBitmapOptions): Promise<ImageBitmap> {
  const versioned = versionedUrl(url);
  if (versioned !== url) {
    try {
      return await decodeImage(versioned, options);
    } catch {
      // An edit can invalidate the version between the manifest and image requests.
    }
  }
  return decodeImage(url, options);
}

async function decodeImage(url: string, options?: ImageBitmapOptions): Promise<ImageBitmap> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
  return createImageBitmap(img, options);
}

export async function fetchAsset(url: string): Promise<Response> {
  const versioned = versionedUrl(url);
  if (versioned !== url) {
    const result = await fetch(versioned, { cache: "force-cache" });
    if (result.status !== 404) return result;
  }
  return fetch(url);
}

/** Load and parse JSON from the given URL. */
export function loadJSON<T>(url: string): Promise<T> {
  return fetchAsset(url).then((res) => {
    if (!res.ok) throw new Error(`Failed to load JSON: ${url} (${res.status})`);
    return res.json() as Promise<T>;
  });
}
