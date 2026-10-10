export const FAULT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const FAULT_KINDS = ["fatal", "server-hang", "request-timeout", "chunk-failure"] as const;
export interface FaultAuthority {
  state: string;
  ticks: number;
  hidden: boolean;
  queuedBytes: number;
  inFlightBytes: number;
  realms: {
    realmId: string;
    loadedChunks: number;
    transitioningPlayers: number;
    loading: number;
    failed: number;
    failures: number;
    lastError: string;
  }[];
}
export interface FaultReport {
  id: string;
  capturedAt: string;
  kind: (typeof FAULT_KINDS)[number];
  message: string;
  stack: string;
  build: string;
  browser: string;
  context: {
    mode: string;
    worldId: string;
    generation: string;
    x: number;
    y: number;
    serverTick: number;
    hidden: boolean;
  };
  events: { at: number; type: string }[];
  authority: FaultAuthority | null;
}
export interface StoredFaultReport extends FaultReport {
  receivedAt: string;
}
/** Whitelist fields at both ends; exclude profiles, credentials, request arguments and saved worlds. */
export function parseFaultReport(raw: unknown): FaultReport {
  const v = raw as FaultReport;
  const s = (value: unknown, max: number): string => {
    if (typeof value !== "string" || value.length > max) throw Error("Invalid fault report string");
    return value;
  };
  const n = (value: unknown, max = 1e12): number => {
    if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > max)
      throw Error("Invalid fault report number");
    return value;
  };
  const b = (value: unknown): boolean => {
    if (typeof value !== "boolean") throw Error("Invalid fault report boolean");
    return value;
  };
  if (!v || !FAULT_ID.test(s(v.id, 36)) || !FAULT_KINDS.includes(v.kind))
    throw Error("Invalid fault report");
  if (!Number.isFinite(Date.parse(s(v.capturedAt, 40)))) throw Error("Invalid fault report date");
  if (!Array.isArray(v.events) || v.events.length > 24) throw Error("Invalid fault report events");
  const c = v.context;
  let authority: FaultAuthority | null = null;
  if (v.authority !== null) {
    const a = v.authority;
    if (!a || !Array.isArray(a.realms) || a.realms.length > 8)
      throw Error("Invalid fault authority");
    authority = {
      state: s(a.state, 40),
      ticks: n(a.ticks),
      hidden: b(a.hidden),
      queuedBytes: n(a.queuedBytes),
      inFlightBytes: n(a.inFlightBytes),
      realms: a.realms.map((r) => ({
        realmId: s(r.realmId, 100),
        loadedChunks: n(r.loadedChunks),
        transitioningPlayers: n(r.transitioningPlayers),
        loading: n(r.loading),
        failed: n(r.failed),
        failures: n(r.failures),
        lastError: s(r.lastError, 1000),
      })),
    };
  }
  return {
    id: v.id,
    capturedAt: v.capturedAt,
    kind: v.kind,
    message: s(v.message, 2000),
    stack: s(v.stack, 8000),
    build: s(v.build, 100),
    browser: s(v.browser, 500),
    context: {
      mode: s(c?.mode, 40),
      worldId: s(c?.worldId, 100),
      generation: s(c?.generation, 2000),
      x: n(c?.x),
      y: n(c?.y),
      serverTick: n(c?.serverTick),
      hidden: b(c?.hidden),
    },
    events: v.events.map((e) => ({ at: n(e.at, 1e15), type: s(e.type, 80) })),
    authority,
  };
}
