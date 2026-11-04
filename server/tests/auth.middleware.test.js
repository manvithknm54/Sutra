import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
import { requireAuth, requireRole, COOKIE } from "../src/middleware/auth.js";

process.env.JWT_SECRET = "test-secret-test-secret-test-secret-123";

function run(mw, req) {
  const res = {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  const next = vi.fn();
  mw(req, res, next);
  return { res, next };
}

const tokenFor = (role) =>
  jwt.sign({ role, campusId: "c1" }, process.env.JWT_SECRET, { subject: "u1", expiresIn: "1h" });

describe("requireAuth", () => {
  it("rejects a request with no cookie", () => {
    const { res, next } = run(requireAuth, { cookies: {} });
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
  it("rejects a tampered token", () => {
    const bad = tokenFor("ADMIN").slice(0, -3) + "abc";
    const { res } = run(requireAuth, { cookies: { [COOKIE]: bad } });
    expect(res.statusCode).toBe(401);
  });
  it("accepts a valid token and sets req.user", () => {
    const req = { cookies: { [COOKIE]: tokenFor("FACULTY") } };
    const { next } = run(requireAuth, req);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: "u1", role: "FACULTY", campusId: "c1" });
  });
});

describe("requireRole", () => {
  it("blocks faculty from admin routes", () => {
    const { res, next } = run(requireRole("ADMIN"), { user: { role: "FACULTY" } });
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
  it("lets admin through", () => {
    const { next } = run(requireRole("ADMIN"), { user: { role: "ADMIN" } });
    expect(next).toHaveBeenCalled();
  });
});