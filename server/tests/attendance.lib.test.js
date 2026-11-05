import { describe, it, expect } from "vitest";
import { classify, isShortage, percent, weekKey } from "../src/lib/attendance.js";

describe("75% rule", () => {
  it("75.0% is not a shortage", () => expect(isShortage(3, 4)).toBe(false));
  it("74.9% is a shortage", () => expect(isShortage(749, 1000)).toBe(true));
  it("75.1% is not a shortage", () => expect(isShortage(751, 1000)).toBe(false));
  it("no sessions is not a shortage", () => expect(isShortage(0, 0)).toBe(false));
  it("matches the brief's sample students", () => {
    expect(percent(163, 200)).toBe(81.5);   // Subhashree
    expect(percent(30, 44)).toBe(68.2);     // Ankit
    expect(isShortage(30, 44)).toBe(true);
    expect(isShortage(163, 200)).toBe(false);
  });
});

describe("weekKey (alert idempotency)", () => {
  it("gives ISO weeks", () => {
    expect(weekKey(new Date("2026-11-04T10:00:00Z"))).toBe("2026-W45");
    expect(weekKey(new Date("2026-12-31T10:00:00Z"))).toBe("2026-W53");
    expect(weekKey(new Date("2027-01-01T10:00:00Z"))).toBe("2026-W53");
  });
});

describe("sync classification", () => {
  const base = { userId: "u1", date: "2026-11-04", today: "2026-11-04" };
  const stored = { markedById: "u1", absentIds: ["a", "b"] };

  it("creates a new session", () =>
    expect(classify({ ...base, byId: null, bySlot: null, absent: ["a"] })).toBe("create"));
  it("same batch sent twice is a no-op (idempotent)", () =>
    expect(classify({ ...base, byId: stored, bySlot: null, absent: ["b", "a"] })).toBe("duplicate"));
  it("same-day edit by the same teacher updates", () =>
    expect(classify({ ...base, byId: stored, bySlot: null, absent: ["a"] })).toBe("update"));
  it("edit by someone else conflicts", () =>
    expect(classify({ ...base, userId: "u2", byId: stored, bySlot: null, absent: ["a"] })).toBe("conflict"));
  it("late edit on a past day conflicts", () =>
    expect(classify({ ...base, today: "2026-11-05", byId: stored, bySlot: null, absent: ["a"] })).toBe("conflict"));
  it("a period already marked from another device conflicts", () =>
    expect(classify({ ...base, byId: null, bySlot: { id: "other" }, absent: ["a"] })).toBe("conflict"));
});