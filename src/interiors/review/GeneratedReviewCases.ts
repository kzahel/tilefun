import { generateProbe } from "./CounterexampleGenerator.js";

// Stable review specifications selected against stages 0–13. Reproduce offline:
// npm run interiors:counterexamples -- search --through-stage 13
// Never enumerate, audit, or reselect the corpus in the browser.
export const GENERATED_REVIEW_SEEDS = [65, 677, 267, 987, 832, 112, 254, 938] as const;
export const generatedReviewCases = () => GENERATED_REVIEW_SEEDS.map(generateProbe);
