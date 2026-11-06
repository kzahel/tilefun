/** Return a present value or throw. The default message predates the move from `art/ArtCatalog`. */
export function required<T>(value: T | null | undefined, message = "Missing art source"): T {
  if (value === undefined || value === null) throw new Error(message);
  return value;
}
