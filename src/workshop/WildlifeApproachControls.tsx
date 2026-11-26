import type { RefObject } from "react";
import type { LabView } from "../client/LabView.js";
import type { PositionComponent } from "../entities/Entity.js";
import { faunaProfile } from "../wildlife/Fauna.js";

export function WildlifeApproachControls({
  lab,
  canvas,
  animal,
  disabled,
  retreat,
  reportError,
}: {
  lab: RefObject<LabView | null>;
  canvas: RefObject<HTMLCanvasElement | null>;
  animal: { type: string; name: string };
  disabled: boolean;
  retreat: PositionComponent | undefined;
  reportError: (error: string) => void;
}) {
  const movePlayer = (position: PositionComponent) => {
    void lab.current
      ?.command({ kind: "teleport", position, z: 0 })
      .catch((error) => reportError(String(error)));
    canvas.current?.focus();
  };
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          const target = lab.current?.client.replica.entities.find(
            (entry) => entry.type === animal.type && (entry.wz ?? 0) < 0.5,
          );
          if (!target) return;
          const profile = faunaProfile(animal.type);
          const distance = profile
            ? Math.min(profile.alarmDistance - 1, profile.body[0] / 2 + 7)
            : 24;
          movePlayer({ wx: target.position.wx - distance, wy: target.position.wy });
        }}
      >
        Start near {animal.name}
      </button>
      {retreat && (
        <button type="button" disabled={disabled} onClick={() => movePlayer(retreat)}>
          Step away
        </button>
      )}
    </>
  );
}
