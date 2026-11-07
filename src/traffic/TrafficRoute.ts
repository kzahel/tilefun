/** Durable lane progress for an autonomous road vehicle. */
export interface TrafficRoute {
  laneId: string;
  choices: number;
  nextId?: string;
  turning?: boolean;
}
/** Saved-record shape check; lane identities are resolved later against the graph. */
export function validTrafficRoute(route: TrafficRoute | null): boolean {
  return (
    !!route &&
    typeof route.laneId === "string" &&
    route.laneId.length <= 512 &&
    Number.isSafeInteger(route.choices) &&
    route.choices >= 0 &&
    route.choices <= 0xffff_ffff &&
    (route.nextId === undefined ||
      (typeof route.nextId === "string" && route.nextId.length <= 512)) &&
    (route.turning === undefined || typeof route.turning === "boolean")
  );
}
