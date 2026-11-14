export type FirstPersonControls = "simple" | "mouse";

/** New players use keyboard turning; old profiles can retain mouse look. */
export function firstPersonControls(
  value: unknown,
  fallback: FirstPersonControls = "simple",
): FirstPersonControls {
  return value === "simple" || value === "mouse" ? value : fallback;
}
