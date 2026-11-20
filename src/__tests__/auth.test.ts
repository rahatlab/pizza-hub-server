import { describe, it, expect } from "vitest";
import { signToken, verifyToken } from "../lib/jwt.js";
import { sendSuccess, sendError } from "../lib/response.js";
import { STATUS_BY_CODE } from "../lib/response.js";
import { ErrorCodes } from "../lib/response.js";

describe("JWT sign/verify", () => {
  const payload = { userId: "u1", email: "a@b.com", role: "customer" };

  it("signs and verifies a token", () => {
    const token = signToken(payload);
    expect(typeof token).toBe("string");
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe("u1");
    expect(decoded.email).toBe("a@b.com");
    expect(decoded.role).toBe("customer");
  });

  it("rejects tampered token", () => {
    const token = signToken(payload).replace("a", "b");
    expect(() => verifyToken(token)).toThrow();
  });
});

describe("response helpers", () => {
  it("sendSuccess returns envelope", () => {
    const res: any = { status: (c: number) => res, json: (d: any) => { res.body = d; return res; } };
    sendSuccess(res, { ok: true }, "done", 200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("done");
    expect(res.body.data).toEqual({ ok: true });
  });

  it("sendError maps codes to statuses", () => {
    const cases: [ErrorCodes, number][] = [
      ["VALIDATION_ERROR", 400],
      ["UNAUTHORIZED", 401],
      ["FORBIDDEN", 403],
      ["NOT_FOUND", 404],
      ["CONFLICT", 409],
      ["PAYLOAD_TOO_LARGE", 413],
      ["INTERNAL_SERVER_ERROR", 500],
    ];
    for (const [code, expected] of cases) {
      expect(STATUS_BY_CODE[code]).toBe(expected);
    }
  });
});
