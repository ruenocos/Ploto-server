/**
 * protoo message framing (JSON), matching the client's `WebSocketTransport`:
 *
 *   request      { request:true,  id, method, data }
 *   response ok  { response:true, id, ok:true,  data }
 *   response err { response:true, id, ok:false, errorCode, errorReason }
 *   notification { notification:true, method, data }
 *
 * The WebSocket sub-protocol is `protoo`. We keep our own serialiser/parser so
 * the framing is unit-testable offline; room/peer management on the live socket
 * is delegated to the `protoo-server` package (see server.ts), which speaks this
 * exact wire format.
 */

export interface ProtooRequest {
  request: true;
  id: number;
  method: string;
  data: unknown;
}

export interface ProtooResponseOk {
  response: true;
  id: number;
  ok: true;
  data: unknown;
}

export interface ProtooResponseErr {
  response: true;
  id: number;
  ok: false;
  errorCode: number;
  errorReason: string;
}

export interface ProtooNotification {
  notification: true;
  method: string;
  data: unknown;
}

export type ProtooMessage =
  | ProtooRequest
  | ProtooResponseOk
  | ProtooResponseErr
  | ProtooNotification;

export function createRequest(id: number, method: string, data: unknown = {}): ProtooRequest {
  return { request: true, id, method, data };
}

export function createSuccessResponse(id: number, data: unknown = {}): ProtooResponseOk {
  return { response: true, id, ok: true, data };
}

export function createErrorResponse(
  id: number,
  errorCode: number,
  errorReason: string,
): ProtooResponseErr {
  return { response: true, id, ok: false, errorCode, errorReason };
}

export function createNotification(method: string, data: unknown = {}): ProtooNotification {
  return { notification: true, method, data };
}

/** Parse a raw text frame into a protoo message, or throw on a malformed frame. */
export function parse(raw: string): ProtooMessage {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("parse() | invalid JSON");
  }
  if (typeof obj !== "object" || obj === null) {
    throw new Error("parse() | not an object");
  }

  if (obj["request"] === true) {
    if (typeof obj["id"] !== "number" || typeof obj["method"] !== "string") {
      throw new Error("parse() | missing/invalid id or method field");
    }
    return obj as unknown as ProtooRequest;
  }
  if (obj["response"] === true) {
    if (typeof obj["id"] !== "number") {
      throw new Error("parse() | missing/invalid id field");
    }
    return obj as unknown as ProtooResponseOk | ProtooResponseErr;
  }
  if (obj["notification"] === true) {
    if (typeof obj["method"] !== "string") {
      throw new Error("parse() | missing/invalid method field");
    }
    return obj as unknown as ProtooNotification;
  }
  throw new Error("parse() | unknown message type");
}

export function stringify(msg: ProtooMessage): string {
  return JSON.stringify(msg);
}
