/** Standalone poses for retained equipment art/fallback inspection. These are
 * render inputs; game bodies do not carry articulated/coupled physics state. */
export interface EquipmentPose {
  type: string;
  position: { wx: number; wy: number };
  wz?: number;
  vehicleHeading?: number;
  sprite?: { direction: number } | null;
  vehicleBedTilt?: number;
  vehicleRamp?: number;
  towedBy?: number;
}
