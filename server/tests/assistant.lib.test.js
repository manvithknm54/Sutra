import { describe, it, expect } from "vitest";
import { SpecSchema, evaluate, ruleParse } from "../src/lib/assistant.js";

const P = [{ code: "CSE", name: "B.Tech Computer Science & Engineering" }, { code: "ME", name: "B.Tech Mechanical Engineering" }];

describe("plain English becomes a structured query", () => {
  it("the brief's own example", () =>
    expect(ruleParse("How many second-year students are below 75% this month?", P))
      .toMatchObject({ select: "count", studyYear: 2, attendanceBelow: 75, period: "this_month" }));
  it("overdue fees over an amount, for one programme", () =>
    expect(ruleParse("Which CSE students have overdue fees of more than ₹20,000?", P))
      .toMatchObject({ programme: "CSE", feeStatus: "overdue", minDueRupees: 20000 }));
  it("reads Indian digit grouping and k suffixes", () => {
    expect(ruleParse("students with fees due more than ₹1,20,000", P).minDueRupees).toBe(120000);
    expect(ruleParse("overdue fees above 20k", P).minDueRupees).toBe(20000);
  });
  it("high risk and consent questions", () => {
    expect(ruleParse("Show high risk students", P)).toMatchObject({ atRisk: true, riskLevel: "high" });
    expect(ruleParse("Minors whose guardian consent is pending", P)).toMatchObject({ consentPending: true });
  });
  it('"show me" does not mean Mechanical', () => expect(ruleParse("show me high risk students", P).programme).toBeUndefined());
  it("never turns an instruction to change data into a query", () => expect(ruleParse("delete all students below 75%", P)).toBeNull());
  it("returns nothing for questions it can't map", () => expect(ruleParse("what is the weather today", P)).toBeNull());
});

describe("the spec is a strict contract", () => {
  it("rejects out-of-range values", () => expect(SpecSchema.safeParse({ attendanceBelow: 500 }).success).toBe(false));
  it("drops unknown keys", () =>
    expect(SpecSchema.parse({ programme: "cse", drop: "table" })).toEqual({ select: "list", period: "all", programme: "CSE" }));
});

const st = (id, code, startYear) => ({ id, rollNo: id.toUpperCase(), name: id, category: "GENERAL", isMinor: false, guardianConsent: false,
  batch: { label: "x", startYear, programme: { code } } });
const ctx = () => ({
  students: [st("a", "CSE", 2024), st("b", "CSE", 2024), st("c", "ME", 2024), st("d", "CSE", 2024)],
  att: new Map([["a", { present: 3, total: 4 }], ["b", { present: 749, total: 1000 }], ["c", { present: 10, total: 10 }], ["d", { present: 1, total: 2 }]]),
  feeBy: new Map([["a", { due: 0, status: "CLEARED" }], ["b", { due: 4500000, status: "CRITICAL" }], ["c", { due: 0, status: "CLEARED" }], ["d", { due: 100, status: "PENDING" }]]),
  riskBy: new Map([["b", 70]]), minSessions: 4, term: "2026-27", levelOf: (s) => (s >= 60 ? "high" : "medium"),
});
const base = { select: "list", period: "all" };

describe("running a query (read-only, in memory)", () => {
  it("75.0% is not below 75 and 74.9% is; thin data is reported, not guessed", () => {
    const r = evaluate({ ...base, attendanceBelow: 75 }, ctx());
    expect(r.rows.map((x) => x.id)).toEqual(["b"]);
    expect(r.notEnough).toBe(1);
  });
  it("filters by programme, study year and fees", () => {
    expect(evaluate({ ...base, programme: "ME" }, ctx()).rows.map((x) => x.id)).toEqual(["c"]);
    expect(evaluate({ ...base, studyYear: 2 }, ctx())).toMatchObject({ rows: [], years: [3] });
    expect(evaluate({ ...base, feeStatus: "critical", minDueRupees: 40000 }, ctx()).rows.map((x) => x.id)).toEqual(["b"]);
  });
  it("risk level and sorting", () => {
    expect(evaluate({ ...base, atRisk: true, riskLevel: "high" }, ctx()).rows.map((x) => x.id)).toEqual(["b"]);
    expect(evaluate({ ...base, sortBy: "attendance" }, ctx()).rows.map((x) => x.id)).toEqual(["d", "b", "a", "c"]);
  });
});