import { describe, it, expect } from "vitest";
import {
  createRequest,
  createSuccessResponse,
  createErrorResponse,
  createNotification,
  parse,
  stringify,
} from "../src/signaling/protoo.js";

describe("protoo framing", () => {
  it("round-trips a request", () => {
    const msg = createRequest(7, "join", { displayName: "x" });
    expect(parse(stringify(msg))).toEqual(msg);
  });

  it("round-trips ok and error responses", () => {
    expect(parse(stringify(createSuccessResponse(1, { peers: [] })))).toMatchObject({
      response: true,
      id: 1,
      ok: true,
    });
    expect(parse(stringify(createErrorResponse(2, 403, "forbidden")))).toMatchObject({
      response: true,
      id: 2,
      ok: false,
      errorCode: 403,
      errorReason: "forbidden",
    });
  });

  it("round-trips a notification", () => {
    const msg = createNotification("newPeer", { id: "p2" });
    expect(parse(stringify(msg))).toEqual(msg);
  });

  it("rejects invalid JSON", () => {
    expect(() => parse("{not json")).toThrow(/invalid JSON/);
  });

  it("rejects a request without an id", () => {
    expect(() => parse(JSON.stringify({ request: true, method: "x" }))).toThrow(/id or method/);
  });

  it("rejects an unknown message type", () => {
    expect(() => parse(JSON.stringify({ foo: true }))).toThrow(/unknown message type/);
  });
});
