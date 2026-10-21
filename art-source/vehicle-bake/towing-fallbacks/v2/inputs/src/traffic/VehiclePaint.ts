import catalog from "./vehicle-paints-v1.json" with { type: "json" };

export interface VehiclePaintScheme {
  id: string;
  name: string;
  atlas: string;
  sprite: string;
  swatches: number[][];
  weight: number;
  reviewId: string;
}
/** Wire dictionary: append only; IDs are scoped to a vehicle by the catalog. */
export const VEHICLE_PAINT_IDS = [
  "butter",
  "cream",
  "cherry",
  "teal",
  "powder-blue",
  "forest",
  "forest-cream",
  "navy-cream",
  "navy-stripes",
] as const;
export const VEHICLE_PAINTS = catalog;
const families: Readonly<
  Record<
    string,
    { defaultWeight: number; defaultSwatches: number[][]; schemes: VehiclePaintScheme[] }
  >
> = catalog.families;
export function originalPaintSwatches(type: string): number[][] {
  return families[type.replace(/^vehicle-v1:/, "")]?.defaultSwatches ?? [[100, 100, 110]];
}
export function vehiclePaintSchemes(type: string): readonly VehiclePaintScheme[] {
  return families[type.replace(/^vehicle-v1:/, "")]?.schemes ?? [];
}
export function vehiclePaint(type: string, id?: string): VehiclePaintScheme | undefined {
  return id === undefined ? undefined : vehiclePaintSchemes(type).find((paint) => paint.id === id);
}
export function validVehiclePaint(type: string, id: unknown): id is string | undefined {
  return id === undefined || (typeof id === "string" && !!vehiclePaint(type, id));
}
export function vehiclePaintSheet(type: string, id?: string): string {
  return vehiclePaint(type, id) ? `${type}:paint:${id}` : type;
}
/** Stable authority choice, made once at creation; saved traffic never rerolls. */
export function trafficPaint(type: string, identity: string): string | undefined {
  const family = families[type.replace(/^vehicle-v1:/, "")];
  if (!family) return undefined;
  let hash = 2166136261;
  for (const char of `${identity}:paint-v1`)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  let choice = hash % (family.defaultWeight + family.schemes.reduce((sum, p) => sum + p.weight, 0));
  choice -= family.defaultWeight;
  if (choice < 0) return undefined;
  for (const paint of family.schemes) {
    choice -= paint.weight;
    if (choice < 0) return paint.id;
  }
  return undefined;
}
export function paintWireIndex(id: string): number {
  const index = (VEHICLE_PAINT_IDS as readonly string[]).indexOf(id);
  if (index < 0) throw Error(`Unknown vehicle paint ${id}`);
  return index;
}
export function paintFromWire(index: number): string {
  const id = VEHICLE_PAINT_IDS[index];
  if (!id) throw Error(`Unknown vehicle paint index ${index}`);
  return id;
}
