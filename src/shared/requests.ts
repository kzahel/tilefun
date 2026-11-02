import type { ClientMessage, ServerMessage } from "./protocol.js";

export type RequestMessage = Extract<ClientMessage, { requestId: number }>;

const RESPONSES = {
  "enter-vehicle": "vehicle-controlled",
  "exit-vehicle": "vehicle-controlled",
  "set-player-model": "player-model-set",
  "load-world": "world-loaded",
  "create-world": "world-created",
  "recreate-world": "world-created",
  "delete-world": "world-deleted",
  "list-worlds": "world-list",
  "rename-world": "world-renamed",
  rcon: "rcon-response",
  "list-realms": "realm-list",
  "get-world-map": "world-map",
  "join-realm": "realm-joined",
  "leave-realm": "realm-left",
  "enter-building": "realm-joined",
  "exit-building": "realm-joined",
} as const satisfies Record<RequestMessage["type"], ServerMessage["type"]>;

export type RequestResponse<R extends RequestMessage> = Extract<
  ServerMessage,
  { type: (typeof RESPONSES)[R["type"]] }
>;

export function isRequestResponse<R extends RequestMessage>(
  request: R,
  response: ServerMessage,
): response is RequestResponse<R> {
  return response.type === RESPONSES[request.type];
}
