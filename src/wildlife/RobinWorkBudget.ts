/** Deterministic shared work admission; no wall-clock-dependent random decisions. */
export interface RobinWorkBudget {
  starts: number;
  candidates: number;
  samples: number;
}

export function robinWorkBudget(): RobinWorkBudget {
  return { starts: 4, candidates: 32, samples: 256 };
}
