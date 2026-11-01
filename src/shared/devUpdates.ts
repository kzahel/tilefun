/** Development-only notifications; no source or private runtime data crosses this channel. */
export interface DevUpdate {
  revision: string;
  state: "editing" | "changed" | "ready";
}
