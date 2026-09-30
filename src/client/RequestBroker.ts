import type { ServerMessage } from "../shared/protocol.js";
import {
  isRequestResponse,
  type RequestMessage,
  type RequestResponse,
} from "../shared/requests.js";

interface PendingRequest {
  settle: (response: ServerMessage) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Correlates typed requests and owns their lifetime independently of the game UI. */
export class RequestBroker {
  private readonly pending = new Map<number, PendingRequest>();
  private disposed = false;

  constructor(
    private readonly transmit: (message: RequestMessage) => void,
    private readonly timeoutMs = 30_000,
  ) {}

  send<R extends RequestMessage>(request: R): Promise<RequestResponse<R>> {
    if (this.disposed) return Promise.reject(new Error("Game client destroyed."));
    if (this.pending.has(request.requestId))
      return Promise.reject(new Error(`Duplicate request ID: ${request.requestId}`));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(request.requestId);
        reject(new Error(`Request timed out: ${request.type}`));
      }, this.timeoutMs);
      this.pending.set(request.requestId, {
        timer,
        reject,
        settle: (response) => {
          if (response.type === "request-error") reject(new Error(response.message));
          else if (isRequestResponse(request, response)) resolve(response);
          else reject(new Error(`Unexpected response to ${request.type}: ${response.type}`));
        },
      });
      try {
        this.transmit(request);
      } catch (error) {
        this.pending.delete(request.requestId);
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  receive(message: ServerMessage): void {
    if (!("requestId" in message) || message.requestId === undefined) return;
    const pending = this.pending.get(message.requestId);
    if (!pending) return;
    this.pending.delete(message.requestId);
    clearTimeout(pending.timer);
    pending.settle(message);
  }

  disconnect(): void {
    this.rejectAll(new Error("Connection to server closed."));
  }

  dispose(): void {
    this.disposed = true;
    this.rejectAll(new Error("Game client destroyed."));
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
