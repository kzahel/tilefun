export interface RoomInfo {
  peerId: string;
  name: string;
  playerCount: number;
  hostName: string;
}

export class RoomDirectory {
  private baseUrl: string;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /** Start heartbeat — PUT immediately then every 30s. */
  startHeartbeat(
    peerId: string,
    info: { name: string; playerCount: number; hostName: string },
    getPlayerCount?: () => number,
  ): void {
    this.stopHeartbeat();
    const put = () => {
      if (getPlayerCount) {
        info.playerCount = getPlayerCount();
      }
      fetch(`${this.baseUrl}/rooms/${encodeURIComponent(peerId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(info),
      }).catch((err) => console.warn("[RoomDirectory] heartbeat failed:", err));
    };
    put();
    this.intervalId = setInterval(put, 30_000);
  }

  /** Stop heartbeat. */
  stopHeartbeat(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Fetch list of active public rooms. */
  async listRooms(): Promise<RoomInfo[]> {
    try {
      const resp = await fetch(`${this.baseUrl}/rooms`);
      return (await resp.json()) as RoomInfo[];
    } catch (err) {
      console.warn("[RoomDirectory] listRooms failed:", err);
      return [];
    }
  }
}
