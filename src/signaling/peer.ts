/**
 * A connected peer on a protoo WebSocket.
 *
 * Wraps a `ws` socket and speaks the exact protoo wire format (see protoo.ts):
 * it emits inbound requests to a handler and serialises the handler's result (or
 * thrown error) back as a protoo response. Server-initiated notifications go out
 * via {@link notify}.
 */
import type { WebSocket } from "ws";
import type { PeerLike } from "./gameRoom.js";
import {
  createErrorResponse,
  createNotification,
  createSuccessResponse,
  parse,
  stringify,
  type ProtooRequest,
} from "./protoo.js";

export type RequestHandler = (
  peer: Peer,
  method: string,
  data: unknown,
) => unknown | Promise<unknown>;

export class Peer implements PeerLike {
  closed = false;

  constructor(
    readonly id: string,
    readonly roomId: string,
    private readonly socket: WebSocket,
    private readonly onRequest: RequestHandler,
    private readonly onClose: (peer: Peer) => void,
  ) {
    this.socket.on("message", (raw) => this.handleRaw(String(raw)));
    this.socket.on("close", () => {
      if (this.closed) return;
      this.closed = true;
      this.onClose(this);
    });
    this.socket.on("error", () => {
      /* surfaced as a subsequent close */
    });
  }

  notify(method: string, data: unknown): void {
    this.send(stringify(createNotification(method, data)));
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.socket.close();
    } catch {
      /* already gone */
    }
  }

  private send(text: string): void {
    if (this.closed) return;
    try {
      this.socket.send(text);
    } catch {
      /* socket died mid-send; close handler will fire */
    }
  }

  private async handleRaw(raw: string): Promise<void> {
    let msg;
    try {
      msg = parse(raw);
    } catch {
      return; // ignore malformed frames, as the reference client does
    }
    if (!("request" in msg) || msg.request !== true) return; // we only service requests
    await this.dispatch(msg);
  }

  private async dispatch(req: ProtooRequest): Promise<void> {
    try {
      const data = await this.onRequest(this, req.method, req.data);
      this.send(stringify(createSuccessResponse(req.id, data ?? {})));
    } catch (err) {
      const reason = err instanceof Error ? err.message : "internal error";
      this.send(stringify(createErrorResponse(req.id, 500, reason)));
    }
  }
}
