import { lazy, type ReactElement } from "react";
import type { WorkshopToolId } from "./ToolRegistry.js";
import { AuthGate } from "./WorkshopCommon.js";

const CharactersPage = lazy(() => import("./CharactersPage.js"));
const CarProjectionPage = lazy(() => import("./CarProjectionPage.js"));
const WorldGeometryPage = lazy(() => import("./WorldGeometryPage.js"));
const PhysicsPage = lazy(() => import("./PhysicsPage.js"));
const VehiclesPage = lazy(() => import("./VehiclesPage.js"));
const FamilySheetsPage = lazy(() => import("./FamilySheetsPage.js"));
const PatternPage = lazy(() => import("./PatternPage.js"));
const ParkingPage = lazy(() => import("./ParkingPage.js"));
const OutdoorPage = lazy(() => import("./OutdoorPage.js"));

/** Tools with their own Workshop page. Tools absent here open by their registry `mode`. */
export const TOOL_PAGES: Partial<Record<WorkshopToolId, ReactElement>> = {
  patterns: <PatternPage />,
  "parking-lab": <ParkingPage />,
  "character-lab": (
    <AuthGate>
      <CharactersPage />
    </AuthGate>
  ),
  "car-projection": <CarProjectionPage />,
  traffic: <WorldGeometryPage defaultFixture="traffic" />,
  "world-geometry": <WorldGeometryPage />,
  physics: <PhysicsPage />,
  vehicles: (
    <AuthGate>
      <VehiclesPage />
    </AuthGate>
  ),
  outdoor: <OutdoorPage />,
  families: <FamilySheetsPage />,
};
