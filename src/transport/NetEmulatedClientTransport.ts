import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import type { ClientTransportDebugInfo, IClientTransport } from "./Transport.js";

export interface NetEmulationConfig {
  enabled: boolean;
  txLossPct: number;
  rxLossPct: number;
  txLatencyMs: number;
  rxLatencyMs: number;
  txJitterMs: number;
  rxJitterMs: number;
}

const DEFAULT_CONFIG: NetEmulationConfig = {
  enabled: false,
  txLossPct: 0,
  rxLossPct: 0,
  txLatencyMs: 0,
  rxLatencyMs: 0,
  txJitterMs: 0,
  rxJitterMs: 0,
};

/**
 * Client-side network emulator wrapper.
 * Injects packet loss and delay for both send and receive paths.
 */
export class NetEmulatedClientTransport implements IClientTransport {
  private messageHandler: ((msg: ServerMessage) => void) | null = null;
  private config: NetEmulationConfig = { ...DEFAULT_CONFIG };
  private closed = false;
  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();

  constructor(private readonly base: IClientTransport) {
    this.base.onMessage((msg) => this.handleIncoming(msg));
  }

  setConfig(config: Partial<NetEmulationConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      txLossPct: clamp(config.txLossPct ?? this.config.txLossPct, 0, 100),
      rxLossPct: clamp(config.rxLossPct ?? this.config.rxLossPct, 0, 100),
      txLatencyMs: Math.max(0, config.txLatencyMs ?? this.config.txLatencyMs),
      rxLatencyMs: Math.max(0, config.rxLatencyMs ?? this.config.rxLatencyMs),
      txJitterMs: Math.max(0, config.txJitterMs ?? this.config.txJitterMs),
      rxJitterMs: Math.max(0, config.rxJitterMs ?? this.config.rxJitterMs),
    };
  }

  getConfig(): NetEmulationConfig {
    return { ...this.config };
  }

  get bytesReceived(): number {
    return this.base.bytesReceived ?? 0;
  }

  getDebugInfo(): ClientTransportDebugInfo {
    const base = this.base.getDebugInfo?.() ?? { transport: "Unknown" };
    if (!this.config.enabled) return base;
    return { ...base, transport: `${base.transport} + netem` };
  }

  send(msg: ClientMessage): void {
    if (this.closed) return;
    if (!this.config.enabled) {
      this.base.send(msg);
      return;
    }

    if (shouldDrop(this.config.txLossPct)) return;
    this.scheduleOrRun(this.config.txLatencyMs, this.config.txJitterMs, () => this.base.send(msg));
  }

  onMessage(handler: (msg: ServerMessage) => void): void {
    this.messageHandler = handler;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const timer of this.pendingTimers) {
      clearTimeout(timer);
    }
    this.pendingTimers.clear();
    this.base.close();
  }

  private handleIncoming(msg: ServerMessage): void {
    if (this.closed) return;
    if (!this.config.enabled) {
      this.messageHandler?.(msg);
      return;
    }

    if (shouldDrop(this.config.rxLossPct)) return;
    this.scheduleOrRun(this.config.rxLatencyMs, this.config.rxJitterMs, () =>
      this.messageHandler?.(msg),
    );
  }

  private scheduleOrRun(latencyMs: number, jitterMs: number, fn: () => void): void {
    const delay = sampleDelayMs(latencyMs, jitterMs);
    if (delay <= 0) {
      fn();
      return;
    }
    const timer = setTimeout(() => {
      this.pendingTimers.delete(timer);
      if (this.closed) return;
      fn();
    }, delay);
    this.pendingTimers.add(timer);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function shouldDrop(lossPct: number): boolean {
  return Math.random() * 100 < lossPct;
}

function sampleDelayMs(baseMs: number, jitterMs: number): number {
  if (jitterMs <= 0) return baseMs;
  const jitter = (Math.random() * 2 - 1) * jitterMs;
  return Math.max(0, baseMs + jitter);
}
