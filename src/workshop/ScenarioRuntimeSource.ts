import predictor from "../client/PlayerPredictor.ts?raw";
import movement from "../entities/EntityManager.ts?raw";
import bodyRotation from "../physics/BodyRotation.ts?raw";
import gravity from "../physics/Gravity.ts?raw";
import jumpAssist from "../physics/JumpAssist.ts?raw";
import physicalEdits from "../physics/PhysicalEdits.ts?raw";
import physicsBodies from "../physics/PhysicsBodies.ts?raw";
import physicsDefaults from "../physics/PhysicsDefaults.ts?raw";
import physics from "../physics/PhysicsScene.ts?raw";
import physicsState from "../physics/PhysicsState.ts?raw";
import controls from "../physics/PlayerControls.ts?raw";
import clippedTerrain from "../physics/rapier/ClippedTerrain.ts?raw";
import collisionGeometry from "../physics/rapier/CollisionGeometry.ts?raw";
import vehicleChassis from "../physics/VehicleChassis.ts?raw";
import vehicleMotor from "../physics/VehicleMotor.ts?raw";
import railServices from "../railway/RailwayServices.ts?raw";
import stationBench from "../railway/StationBench.ts?raw";
import actorRaster from "../rendering/ActorRaster.ts?raw";
import cameraRaster from "../rendering/Camera.ts?raw";
import spriteRaster from "../rendering/Canvas2DRenderer.ts?raw";
import interiorRaster from "../rendering/CanvasInteriorResources.ts?raw";
import canvasBackend from "../rendering/CanvasRenderBackend.ts?raw";
import canvasHost from "../rendering/CanvasRenderHost.ts?raw";
import curveSprite from "../rendering/CurveTrainPresentation.ts?raw";
import sceneCollection from "../rendering/collectScene.ts?raw";
import dumpSprite from "../rendering/DumpTruckFallback.ts?raw";
import gpuBodies from "../rendering/GpuMeshBodies.ts?raw";
import gpuRaster from "../rendering/GpuRasterSurface.ts?raw";
import gpuHost from "../rendering/GpuRenderHost.ts?raw";
import particleEffects from "../rendering/ParticleSystem.ts?raw";
import presentationSettings from "../rendering/PresentationSettings.ts?raw";
import projectedDecals from "../rendering/ProjectedDecals.ts?raw";
import projection from "../rendering/Projection.ts?raw";
import rasterBackend from "../rendering/RasterRenderBackend.ts?raw";
import subpixelImages from "../rendering/SubpixelImages.ts?raw";
import surfaceMeshIndex from "../rendering/SurfaceMeshIndex.ts?raw";
import surfaceReceivers from "../rendering/SurfaceReceivers.ts?raw";
import terrainPlacement from "../rendering/TerrainFrame.ts?raw";
import towingSprite from "../rendering/TowingFallback.ts?raw";
import transporterSprite from "../rendering/TransporterFallback.ts?raw";
import worldDepth from "../rendering/WorldDepth.ts?raw";
import worldRaster from "../rendering/WorldRasterFrame.ts?raw";
import client from "../scenarios/ScenarioClient.ts?raw";
import presentation from "../scenarios/ScenarioPresentationHost.ts?raw";
import protocol from "../scenarios/ScenarioProtocol.ts?raw";
import replica from "../scenarios/ScenarioReplica.ts?raw";
import session from "../scenarios/ScenarioSession.ts?raw";
import worker from "../scenarios/ScenarioWorkerHost.ts?raw";
import entry from "../scenarios/scenario.worker.ts?raw";
import realm from "../server/Realm.ts?raw";
import realmWildlife from "../server/RealmWildlife.ts?raw";
import clock from "../server/ServerLoop.ts?raw";
import wireCodec from "../shared/binaryCodec.ts?raw";
import entityDelta from "../shared/entityDelta.ts?raw";
import physicsCodec from "../shared/physicsStateCodec.ts?raw";
import serialization from "../shared/serialization.ts?raw";
import roadTraffic from "../traffic/RoadTraffic.ts?raw";
import roadTurn from "../traffic/RoadTurn.ts?raw";
import vehicleRegistry from "../traffic/VehicleRegistry.ts?raw";
import channel from "../transport/OrderedWorkerChannel.ts?raw";
import fierceProfiles from "../wildlife/FierceCreatures.ts?raw";
import fierceDens from "../wildlife/FierceDens.ts?raw";
import foodWeb from "../wildlife/FoodWeb.ts?raw";
import predators from "../wildlife/Predator.ts?raw";
import predatorMotion from "../wildlife/PredatorMotion.ts?raw";
import predatorAI from "../wildlife/predatorAI.ts?raw";
import wildlifeRespawns from "../wildlife/WildlifeRespawns.ts?raw";

/** Live behavior reviews include host timing/transport, not just recipe/physics. */
export const scenarioRuntimeSource = {
  railServices,
  stationBench,
  vehicleChassis,
  bodyRotation,
  worldDepth,
  physics,
  physicsState,
  physicalEdits,
  physicsBodies,
  realmWildlife,
  physicsDefaults,
  gravity,
  jumpAssist,
  controls,
  vehicleMotor,
  roadTraffic,
  roadTurn,
  vehicleRegistry,
  predictor,
  presentationSettings,
  particleEffects,
  projectedDecals,
  surfaceReceivers,
  surfaceMeshIndex,
  projection,
  cameraRaster,
  sceneCollection,
  curveSprite,
  transporterSprite,
  towingSprite,
  dumpSprite,
  interiorRaster,
  worldRaster,
  rasterBackend,
  canvasHost,
  canvasBackend,
  gpuHost,
  gpuRaster,
  gpuBodies,
  spriteRaster,
  terrainPlacement,
  subpixelImages,
  actorRaster,
  physicsCodec,
  wireCodec,
  entityDelta,
  serialization,
  replica,
  collisionGeometry,
  clippedTerrain,
  generation,
  predatorAI,
  wildlifeRespawns,
  predators,
  predatorMotion,
  fierceProfiles,
  fierceDens,
  foodWeb,
  movement,
  realm,
  client,
  presentation,
  protocol,
  session,
  worker,
  entry,
  clock,
  channel,
};

import generation from "../generation/Generator.ts?raw";
