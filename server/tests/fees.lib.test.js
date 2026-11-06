import { describe, it, expect } from "vitest";
import { checkAmount, dueOf, inr, overdueDays, receiptLabel, statusOf, studyYear, toPaise } from "../src/lib/fees.js";

describe("dues are charges minus payments minus scholarships", () => {
  it("matches the brief's sample student (Rs 45,000 due)", () =>
    expect(dueOf({ charge: toPaise(85000), payment: toPaise(40000) })).toBe(toPaise(45000)));
  it("a scholarship reduces what is due", () =>
    expect(dueOf({ charge: toPaise(120000), scholarship: toPaise(10000), payment: toPaise(60000) })).toBe(toPaise(50000)));
  it("a fully paid student owes nothing", () => expect(dueOf({ charge: 6000000, payment: 6000000 })).toBe(0));
  it("an empty ledger owes nothing", () => expect(dueOf()).toBe(0));
});

describe("aging", () => {
  it("counts days past the due date", () => expect(overdueDays("2026-08-31", "2026-11-06")).toBe(67));
  it("is zero before the due date", () => expect(overdueDays("2026-12-01", "2026-11-06")).toBe(0));
  it("has no overdue days without a due date", () => expect(overdueDays(null, "2026-11-06")).toBe(0));
});

describe("fee status boundaries", () => {
  it("60 days is overdue, 61 is critical", () => {
    expect(statusOf(100, 60)).toBe("OVERDUE");
    expect(statusOf(100, 61)).toBe("CRITICAL");
  });
  it("not yet due, and cleared", () => {
    expect(statusOf(100, 0)).toBe("PENDING");
    expect(statusOf(0, 90)).toBe("CLEARED");
    expect(statusOf(-5, 0)).toBe("CLEARED");
  });
});

describe("payment amount checks", () => {
  it("accepts the exact due and part payments", () => { expect(checkAmount(4500000, 4500000)).toBeNull(); expect(checkAmount(100, 4500000)).toBeNull(); });
  it("rejects more than is due", () => expect(checkAmount(4500100, 4500000)).toBe("TOO_MUCH"));
  it("rejects zero, negative and fractional", () => {
    expect(checkAmount(0, 100)).toBe("INVALID"); expect(checkAmount(-5, 100)).toBe("INVALID"); expect(checkAmount(10.5, 100)).toBe("INVALID");
  });
  it("rejects paying when nothing is due", () => expect(checkAmount(100, 0)).toBe("NO_DUE"));
});

describe("helpers", () => {
  it("study year from the term", () => expect(studyYear(2024, "2026-27")).toBe(3));
  it("Indian digit grouping", () => expect(inr(12000000)).toBe("₹1,20,000"));
  it("receipt numbers are padded", () => expect(receiptLabel(7, 2026)).toBe("RCT-2026-000007"));
});