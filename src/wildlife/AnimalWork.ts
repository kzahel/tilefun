import type { PositionComponent } from "../entities/Entity.js";

/** Authoritative semantic state. Only ordinary poses/attachments cross the wire. */
export interface AnimalWork {
  kind:
    | "dog"
    | "crow"
    | "squirrel"
    | "rabbit"
    | "robin"
    | "meerkat"
    | "capuchin"
    | "raccoon"
    | "cat"
    | "goat"
    | "pig"
    | "elephant"
    | "chicken"
    | "bee"
    | "hummingbird"
    | "horse"
    | "giraffe"
    | "beaver"
    | "cow"
    | "sheep"
    | "donkey"
    | "deer"
    | "peacock"
    | "raven";
  state:
    | "idle"
    | "seek"
    | "pickup"
    | "return"
    | "deposit"
    | "retrieve"
    | "eat"
    | "rest"
    | "scan"
    | "alarm"
    | "lower"
    | "climb"
    | "descend"
    | "stalk"
    | "pounce"
    | "bat"
    | "perch"
    | "rear"
    | "browse"
    | "sniff"
    | "root"
    | "reach"
    | "curl"
    | "shake"
    | "hop"
    | "scratch"
    | "peck"
    | "sip"
    | "guard"
    | "graze"
    | "drink"
    | "raise"
    | "build"
    | "settle"
    | "lie"
    | "ruminate"
    | "stand"
    | "bleat"
    | "roll"
    | "stamp"
    | "wait"
    | "open"
    | "display"
    | "close"
    | "bury";
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
  alarms?: number;
  threat?: PositionComponent;
  facing?: number;
  tree?: import("./TreeClimbing.js").ClimbTree;
  stolen?: number;
  played?: number;
  climbZ?: number;
  climbFrom?: PositionComponent & { z: number };
  rock?: import("./BrowsingRocks.js").BrowsingRock;
  hopDown?: boolean;
  hops?: number;
  uncovered?: number;
  harvested?: number;
  shaken?: number;
  lastFlowerId?: string;
  pollinated?: number;
  guardWarned?: boolean;
  warnings?: number;
  drunk?: number;
  ruminated?: number;
  regrouped?: number;
  dustBaths?: number;
  stampedAlarm?: boolean;
  partnerId?: string;
  displayLeader?: boolean;
  courted?: number;
  cacheFacing?: number;
  sourcePosition?: PositionComponent;
}

export type FoodKind = "nut" | "fruit" | "root";
export interface WorkItem {
  kind:
    | "ball"
    | "twig"
    | FoodKind
    | "nest"
    | "cache"
    | "greens"
    | "seed"
    | "nectar"
    | "water"
    | "lodge"
    | "dust"
    | "shiny"
    | "hoard";
  claimedBy?: string;
  /** Stable player identity for thrown balls, or natural lineage/manual owner for a site. */
  owner?: string;
  returnPosition?: PositionComponent;
  returned?: boolean;
  units: number;
  contents: FoodKind[];
  /** Real conserved actors stored in a raven hoard, never edible food counts. */
  storedIds?: string[];
  cachedIn?: string;
  ballOrder?: number;
  pollination?: { remaining: number; count: number };
  growth?: {
    food: "fruit" | "nut" | "seed" | "greens" | "root" | "nectar" | "twig" | "water";
    capacity: number;
    interval: number;
    remaining: number;
    tree?: import("./TreeClimbing.js").ClimbTree;
  };
}
