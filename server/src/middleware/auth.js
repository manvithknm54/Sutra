import jwt from "jsonwebtoken";

export const COOKIE = "sutra_token";

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: "Not signed in" });
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: p.sub, role: p.role, campusId: p.campusId };
    next();
  } catch {
    res.status(401).json({ error: "Session expired. Please sign in again." });
  }
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ error: "You don't have access to this" });