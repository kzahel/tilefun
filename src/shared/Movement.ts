/** One frame of player movement intent, shared by input, prediction and authority. */
export interface Movement {
  dx: number;
  dy: number;
  sprinting: boolean;
  jump: boolean;
  /** Edge-triggered jump press sampled from input events (optional). */
  jumpPressed?: boolean;
  reversing?: boolean;
  relativeDriving?: boolean;
}
