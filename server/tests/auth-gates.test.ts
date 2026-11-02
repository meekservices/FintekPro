/**
 * @file auth-gates.test.ts
 * @description Sprint 2 / U-03 — Verifies that the requireAuth middleware correctly
 *   blocks unauthenticated requests with HTTP 401 and does not call next() for missing sessions.
 *
 * These are pure unit tests for the middleware function.
 * We mock the Express Request/Response/NextFunction interfaces directly —
 * no running HTTP server or DB connection is required.
 */
import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requireAuth } from "../middleware/roleMiddleware";

// ── Minimal mock helpers ─────────────────────────────────────────────────────
function makeReq(user?: unknown): Partial<Request> {
  return { user: user as Request["user"] } as Partial<Request>;
}

function makeRes(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; _status: number; _body: unknown } {
  const res: any = {};
  res._status = 200;
  res._body = null;
  res.status = vi.fn((code: number) => {
    res._status = code;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res._body = body;
    return res;
  });
  return res;
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe("Auth Gates — requireAuth middleware", () => {
  describe("1. Unauthenticated requests are blocked with 401", () => {
    it("returns 401 when req.user is undefined", () => {
      const req = makeReq(undefined);
      const res = makeRes();
      const next: NextFunction = vi.fn();

      requireAuth(req as Request, res as unknown as Response, next);

      expect(res._status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 when req.user is null", () => {
      const req = makeReq(null);
      const res = makeRes();
      const next: NextFunction = vi.fn();

      requireAuth(req as Request, res as unknown as Response, next);

      expect(res._status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("includes success:false in 401 response body", () => {
      const req = makeReq(undefined);
      const res = makeRes();
      const next: NextFunction = vi.fn();

      requireAuth(req as Request, res as unknown as Response, next);

      expect((res._body as any)?.success).toBe(false);
    });

    it("includes AUTH_REQUIRED code in 401 response body", () => {
      const req = makeReq(undefined);
      const res = makeRes();
      const next: NextFunction = vi.fn();

      requireAuth(req as Request, res as unknown as Response, next);

      expect((res._body as any)?.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("2. Authenticated requests pass through to next()", () => {
    it("calls next() when req.user is populated", () => {
      const req = makeReq({ id: "user-123", email: "advisor@example.com", role: "advisor" });
      const res = makeRes();
      const next: NextFunction = vi.fn();

      requireAuth(req as Request, res as unknown as Response, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res._status).toBe(200); // not changed from default
    });

    it("does NOT call res.status() when user is present", () => {
      const req = makeReq({ id: "admin-1", role: "admin" });
      const res = makeRes();
      const next: NextFunction = vi.fn();

      requireAuth(req as Request, res as unknown as Response, next);

      expect(res.status).not.toHaveBeenCalled();
    });

    it("does NOT call res.json() when user is present", () => {
      const req = makeReq({ id: "client-99", role: "client" });
      const res = makeRes();
      const next: NextFunction = vi.fn();

      requireAuth(req as Request, res as unknown as Response, next);

      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("3. Multiple consecutive calls are independent (stateless middleware)", () => {
    it("correctly gates two sequential requests with different auth state", () => {
      const nextAuth: NextFunction = vi.fn();
      const nextUnauth: NextFunction = vi.fn();

      const reqAuth = makeReq({ id: "u1" });
      const reqUnauth = makeReq(undefined);
      const resAuth = makeRes();
      const resUnauth = makeRes();

      requireAuth(reqAuth as Request, resAuth as unknown as Response, nextAuth);
      requireAuth(reqUnauth as Request, resUnauth as unknown as Response, nextUnauth);

      expect(nextAuth).toHaveBeenCalledOnce();
      expect(nextUnauth).not.toHaveBeenCalled();
      expect(resUnauth._status).toBe(401);
    });
  });
});
