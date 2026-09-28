/** Candidate reductions of the pinned Strange/Offset apartment failures.
 * These preserve the relevant joins; visual approval remains with the reviewer.
 */
export const APARTMENT_JOIN_FIXTURES = [
  {
    name: "Adjacent south edges",
    sketch: [
      "########",
      "#LLL#LL#",
      "#LLL#LL#",
      "#LLL#LL#",
      "#LLL#LL#",
      "#LLL####",
      "#####   ",
    ].join("\n"),
  },
  {
    name: "Divider becomes exterior",
    sketch: [
      "########",
      "#LLLLLL#",
      "#LLLLLL#",
      "########",
      "#LLL#   ",
      "#LLL#   ",
      "#####   ",
    ].join("\n"),
  },
  {
    name: "Exterior becomes shared",
    sketch: ["#####   ", "#LLL#   ", "#LLL####", "#LLL#LL#", "#LLL#LL#", "########"].join("\n"),
  },
  {
    name: "Shared wall door before exterior end",
    sketch: [
      "########",
      "#LLL#LL#",
      "#LLL#LL#",
      "#LLL+LL#",
      "#LLL#LL#",
      "#LLL####",
      "#####   ",
    ].join("\n"),
  },
  {
    name: "Shared wall door after exterior start",
    sketch: [
      "#####   ",
      "#LLL#   ",
      "#LLL####",
      "#LLL#LL#",
      "#LLL#LL#",
      "#LLL+LL#",
      "#LLL#LL#",
      "########",
    ].join("\n"),
  },
] as const;

/** Opposite exterior exposures constrain the same continuous wall. This is
 * the thin-profile conflict repro, now also reviewed with a two-sided candidate.
 */
export const CONFLICTING_WALL_FIXTURE = [
  "#####   ",
  "#LLL#   ",
  "#LLL####",
  "#LLL#LL#",
  "#####LL#",
  "    #LL#",
  "    ####",
].join("\n");

export const WIDE_WALL_FIXTURES = [
  {
    name: "Thick wall meets shared partition",
    relatedCaseId: "review-5-97e616c",
    sketch: [
      " #####",
      " #LLL#",
      "######",
      "#L######",
      "#L#LLLL#",
      "###LLLL#",
      "  #LLLL#",
      "  ######",
    ].join("\n"),
  },
  {
    name: "Opposing exterior faces",
    relatedCaseId: "review-5-29624761",
    sketch: CONFLICTING_WALL_FIXTURE,
  },
  {
    name: "Opposing faces with doorway",
    relatedCaseId: "review-5-29624761",
    sketch: [
      "#####   ",
      "#LLL#   ",
      "#LLL####",
      "#LLL#LL#",
      "#LLL#LL#",
      "#LLL+LL#",
      "#####LL#",
      "    #LL#",
      "    ####",
    ].join("\n"),
  },
  {
    name: "Doorway between straight wall sections",
    relatedCaseId: "review-5-29624761",
    // Keep a straight cell below the opening: the earlier doorway reduction
    // put a cutaway branch there and did not reproduce the new Offset pin.
    sketch: [
      "#####   ",
      "#LLL#   ",
      "#LLL####",
      "#LLL#LL#",
      "#LLL#LL#",
      "#LLL+LL#",
      "#LLL#LL#",
      "#####LL#",
      "    #LL#",
      "    ####",
    ].join("\n"),
  },
] as const;
