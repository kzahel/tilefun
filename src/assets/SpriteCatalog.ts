/** Serializable atlas geometry. Loaded images belong exclusively to a backend. */
export interface SpriteMetadata {
  readonly width: number;
  readonly height: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly cols: number;
  readonly rows: number;
}

export function spriteMetadata(
  width: number,
  height: number,
  tileWidth: number,
  tileHeight: number,
): SpriteMetadata {
  return Object.freeze({
    width,
    height,
    tileWidth,
    tileHeight,
    cols: Math.floor(width / tileWidth),
    rows: Math.floor(height / tileHeight),
  });
}

export function spriteRegion(metadata: SpriteMetadata, col: number, row: number) {
  return {
    x: col * metadata.tileWidth,
    y: row * metadata.tileHeight,
    width: metadata.tileWidth,
    height: metadata.tileHeight,
  };
}

export type SpriteCatalog = ReadonlyMap<string, SpriteMetadata>;

/** Load/configuration-time projection; never retains resource wrappers or images. */
export function createSpriteCatalog(
  resources: ReadonlyMap<string, { readonly metadata: SpriteMetadata }>,
): SpriteCatalog {
  return new Map(Array.from(resources, ([key, resource]) => [key, resource.metadata]));
}
