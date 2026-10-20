import { DEER_TYPE } from "../src/wildlife/Deer.js";
import { predatorType } from "../src/wildlife/Predator.js";

export const MANUAL_PREY_PAIRS = [
  { name: "deer", prey: DEER_TYPE, hunter: predatorType("tiger") },
  { name: "wolf", prey: predatorType("wolf"), hunter: predatorType("t-rex") },
  { name: "brown bear", prey: predatorType("brown-bear"), hunter: predatorType("t-rex") },
  { name: "street person", prey: "person1", hunter: predatorType("tiger") },
  { name: "another street person", prey: "person20", hunter: predatorType("lion") },
  { name: "Trail Explorer NPC", prey: "character-person-v1", hunter: predatorType("small-dragon") },
  { name: "indoor resident", prey: "indoor-reader", hunter: predatorType("brown-bear") },
  { name: "person hunted by a dinosaur", prey: "person10", hunter: predatorType("t-rex") },
] as const;
