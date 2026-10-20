import type { PositionComponent } from "../entities/Entity.js";

/** Authoritative semantic state. Only ordinary poses/attachments cross the wire. */
export interface AnimalWork {
  kind: "dog" | "crow" | "squirrel";
  state: "idle" | "seek" | "pickup" | "return" | "deposit" | "retrieve" | "eat" | "rest";
  elapsed: number;
  cooldown: number;
  targetId?: string;
  heldId?: string;
  siteId?: string;
  sitePosition?: PositionComponent & { z: number };
  returnOwner?: string;
  returnPosition?: PositionComponent;
  deliveries: number;
  eaten: number;
  retrieved: number;
  supportCheck?: number;
}

export type FoodKind = "nut" | "fruit";
export interface WorkItem {
  kind: "ball" | "twig" | FoodKind | "nest" | "cache";
  claimedBy?: string;
  /** Stable player identity for thrown balls, or natural lineage/manual owner for a site. */
  owner?: string;
  returnPosition?: PositionComponent;
  returned?: boolean;
  units: number;
  contents: FoodKind[];
}
