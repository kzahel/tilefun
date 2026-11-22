/** Direction IDs follow this order on the input and physics wires. */
export const EXCAVATOR_ACTIONS = [
  "swing-left",
  "swing-right",
  "boom-down",
  "boom-up",
  "stick-in",
  "stick-out",
  "bucket-open",
  "bucket-curl",
] as const;
export type ExcavatorAction = (typeof EXCAVATOR_ACTIONS)[number];
export const isExcavatorAction = (value: unknown): value is ExcavatorAction =>
  typeof value === "string" && (EXCAVATOR_ACTIONS as readonly string[]).includes(value);

export const excavatorActionId = (action: ExcavatorAction) => EXCAVATOR_ACTIONS.indexOf(action) + 1;
export const excavatorActionFromId = (id: number): ExcavatorAction | undefined =>
  EXCAVATOR_ACTIONS[id - 1];
