import type { ClientMessage, ServerMessage } from "./protocol.js";

export type RequestMessage = Extract<ClientMessage, { requestId: number }>;
export type RequestType = RequestMessage["type"];
export type RequestOf<K extends RequestType> = Extract<RequestMessage, { type: K }>;

const RESPONSES = {
  "call-train": "vehicle-controlled",
  "enter-vehicle": "vehicle-controlled",
  "exit-vehicle": "vehicle-controlled",
  "recover-vehicle": "vehicle-controlled",
  "vehicle-equipment": "vehicle-controlled",
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
} as const satisfies Record<RequestType, ServerMessage["type"]>;

export type RequestResponse<R extends RequestMessage> = Extract<
  ServerMessage,
  { type: (typeof RESPONSES)[R["type"]] }
>;

/** The fields a server handler supplies; `type` and `requestId` come from the request. */
export type ResponsePayload<R extends RequestMessage> = Omit<
  RequestResponse<R>,
  "type" | "requestId"
>;

export function isRequest(msg: ClientMessage): msg is RequestMessage {
  return Object.hasOwn(RESPONSES, msg.type);
}

/** Build a request's typed response with the established field order. */
export function responseTo<R extends RequestMessage>(
  request: R,
  payload: ResponsePayload<R>,
): RequestResponse<R> {
  return {
    type: RESPONSES[request.type],
    requestId: request.requestId,
    ...payload,
  } as RequestResponse<R>;
}

export function isRequestResponse<R extends RequestMessage>(
  request: R,
  response: ServerMessage,
): response is RequestResponse<R> {
  return response.type === RESPONSES[request.type];
}
