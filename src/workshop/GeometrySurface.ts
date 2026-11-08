import type { RemoteStateView } from "../client/ClientStateView.js";
import type { LabDiagnostics } from "../client/LabScene.js";
import { LabView } from "../client/LabView.js";
import type { RecipeWorldClient } from "../client/RecipeWorldClient.js";
import { rotateBodyVector } from "../physics/BodyRotation.js";
import { locateSurfaceSpace } from "../physics/TerrainExcavation.js";
import {
  describeSurfaceSupport,
  type SurfaceVisibility,
} from "../rendering/SurfacePresentation.js";
import type { ScenarioCommand } from "../scenarios/ScenarioProtocol.js";
import type { ScenarioRecipe } from "../scenarios/ScenarioRecipe.js";
import { fixedCamera } from "../session/View.js";
import { recordEquipment } from "./EquipmentDiagnostics.js";

/** Fixtures on the game's lab view (226 slice 3c-ii). The others stay on the
 * old lab host until World geometry moves in slice 4a. */
export const LAB_VIEW_FIXTURES = new Set(["car-bridge", "car-garage", "car-dynamics", "car-jumps"]);

/** What the World geometry page drives on either lab surface. */
export interface GeometrySurface {
  readonly ready: Promise<void>;
  readonly replica: RemoteStateView;
  /** Named recipe entities from the latest instrument answer. */
  readonly handles: Record<string, number>;
  command(command: ScenarioCommand): Promise<void>;
  reload(): Promise<void>;
  samplePhysicsDiagnostics: RecipeWorldClient["samplePhysicsDiagnostics"];
  getDiagnostics(): LabDiagnostics;
  dispose(): void;
}

export interface GeometrySurfaceOptions {
  terrain: boolean;
  /** A fixed diagnostic frame; otherwise the game's player follow. */
  camera: { wx: number; wy: number } | undefined;
  zoom: number;
  settings(): { paused: boolean; visibility: SurfaceVisibility };
  onFrame(surface: GeometrySurface): void;
  onError(error: unknown): void;
}

/** The options both surfaces share: the 960×640 canvas, zoom, pause and visibility. */
export function geometryOptions(options: GeometrySurfaceOptions, surface: () => GeometrySurface) {
  return {
    width: 960,
    height: 640,
    terrain: options.terrain,
    surfaceVisibility: () => options.settings().visibility,
    settings: () => ({
      paused: options.settings().paused,
      zoom: options.zoom,
      terrainPacing: "throughput" as const,
    }),
    onFrame: () => options.onFrame(surface()),
    onError: options.onError,
  };
}

export function labViewSurface(
  canvas: HTMLCanvasElement,
  recipe: ScenarioRecipe,
  options: GeometrySurfaceOptions,
): GeometrySurface {
  const lab = new LabView(canvas, recipe, {
    ...geometryOptions(options, () => surface),
    ...(options.camera ? { camera: fixedCamera(options.camera) } : {}),
  });
  const { client } = lab;
  const surface: GeometrySurface = {
    ready: lab.ready,
    get replica() {
      return client.replica;
    },
    get handles() {
      return client.handles;
    },
    command: (command) => lab.command(command),
    reload: () => lab.reload(),
    samplePhysicsDiagnostics: (reset) => client.samplePhysicsDiagnostics(reset),
    getDiagnostics: () => lab.getDiagnostics(),
    dispose: () => lab.dispose(),
  };
  return surface;
}

/** The per-frame datasets browser checks read from the scene canvas. */
export function recordGeometryFrame(
  dataset: DOMStringMap,
  { replica, handles }: GeometrySurface,
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
