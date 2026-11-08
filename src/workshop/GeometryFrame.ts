import type { RecipeWorldClient } from "../client/RecipeWorldClient.js";
import { rotateBodyVector } from "../physics/BodyRotation.js";
import { locateSurfaceSpace } from "../physics/TerrainExcavation.js";
import {
  describeSurfaceSupport,
  type SurfaceVisibility,
} from "../rendering/SurfacePresentation.js";
import { recordEquipment } from "./EquipmentDiagnostics.js";

/** The per-frame datasets browser checks read from the World geometry canvas. */
export function recordGeometryFrame(
  dataset: DOMStringMap,
  { replica, handles }: Pick<RecipeWorldClient, "replica" | "handles">,
  page: {
    visibility: SurfaceVisibility;
    courseRoute: string;
    generated: { seed: number; bridge: { x: number; y: number } | undefined } | undefined;
  },
): void {
  const p = replica.playerEntity,
    server = replica.serverPlayerEntity;
  dataset.playerX = String(p.position.wx);
  dataset.playerY = String(p.position.wy);
  dataset.playerZ = String(p.wz ?? 0);
  dataset.serverZ = String(server.wz ?? 0);
  dataset.support = describeSurfaceSupport(replica.props, p);
  dataset.space = locateSurfaceSpace(replica.props, p);
  dataset.serverSpace = locateSurfaceSpace(replica.props, server);
  dataset.visibility = page.visibility;
  dataset.courseRoute = page.courseRoute;
  dataset.generatedSeed = page.generated ? String(page.generated.seed) : "";
  dataset.bridgeX = String((page.generated?.bridge?.x ?? 0) * 16);
  dataset.bridgeY = String((page.generated?.bridge?.y ?? 0) * 16);
  dataset.surfaceCount = String(replica.props.filter((p) => p.collider?.surface).length);
  const car =
    replica.entities.find((e) => e.id === handles.car) ??
    replica.entities.find((e) => e.type.startsWith("vehicle-v1:"));
  if (car) {
    dataset.carX = String(car.position.wx);
    dataset.carY = String(car.position.wy);
    dataset.carZ = String(car.wz ?? 0);
    dataset.carModel = car.type.slice(11);
    dataset.carUp = String(car.bodyRotation ? rotateBodyVector(car.bodyRotation, 0, 0, 1).z : 1);
    dataset.carRotation = JSON.stringify(car.bodyRotation ?? null);
  }
  recordEquipment(dataset, replica.entities, handles);
  const traffic = replica.entities.filter(
    (e) => e.type.startsWith("vehicle-v1:") && e.id !== handles.car,
  );
  dataset.trafficCount = String(traffic.length);
  const sample = traffic[0];
  if (sample) {
    dataset.trafficX = String(sample.position.wx);
    dataset.trafficY = String(sample.position.wy);
  }
}
