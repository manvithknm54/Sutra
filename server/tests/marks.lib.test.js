import { describe, it, expect } from "vitest";
import { csvCell, deriveUnlock, effectiveDelta, parseMark, transition } from "../src/lib/marks.js";

const ok = (o) => transition({ isOwner: true, ...o });

describe("moderation lock workflow", () => {
  it("faculty owner submits a draft", () => expect(ok({ role: "FACULTY", state: "DRAFT", action: "SUBMIT" })).toMatchObject({ ok: true, to: "SUBMITTED" }));
  it("another faculty cannot submit", () => expect(ok({ role: "FACULTY", isOwner: false, state: "DRAFT", action: "SUBMIT" }).code).toBe(403));
  it("admin cannot submit", () => expect(ok({ role: "ADMIN", state: "DRAFT", action: "SUBMIT" }).code).toBe(403));
  it("faculty cannot edit or submit after submission", () => expect(ok({ role: "FACULTY", state: "SUBMITTED", action: "SUBMIT" }).code).toBe(409));
  it("cannot lock before moderation is completed", () => expect(ok({ role: "ADMIN", state: "SUBMITTED", action: "LOCK" }).code).toBe(409));
  it("admin locks a moderated sheet", () => expect(ok({ role: "ADMIN", state: "MODERATED", action: "LOCK" })).toMatchObject({ ok: true, to: "LOCKED" }));
  it("faculty cannot lock or moderate", () => {
    expect(ok({ role: "FACULTY", state: "MODERATED", action: "LOCK" }).code).toBe(403);
    expect(ok({ role: "FACULTY", state: "SUBMITTED", action: "COMPLETE_MODERATION" }).code).toBe(403);
  });
  it("unlock needs a real reason", () => {
    expect(ok({ role: "ADMIN", state: "LOCKED", action: "UNLOCK_APPROVE", reason: "ok" }).code).toBe(400);
    expect(ok({ role: "ADMIN", state: "LOCKED", action: "UNLOCK_APPROVE", reason: "Typo in two marks" })).toMatchObject({ ok: true, to: "DRAFT" });
  });
  it("an unlock request keeps the sheet locked", () =>
    expect(ok({ role: "FACULTY", state: "LOCKED", action: "UNLOCK_REQUEST", reason: "Wrong roll numbers" })).toMatchObject({ ok: true, to: "LOCKED" }));
  it("nothing can be done to a locked sheet except unlock actions", () =>
    expect(ok({ role: "ADMIN", state: "LOCKED", action: "COMPLETE_MODERATION" }).code).toBe(409));
});

describe("mark validation", () => {
  it("accepts valid marks and blanks", () => { expect(parseMark(7.5, 10)).toBe(7.5); expect(parseMark(null, 10)).toBeNull(); expect(parseMark(10, 10)).toBe(10); });
  it("rejects above the component maximum", () => expect(() => parseMark(10.5, 10)).toThrow());
  it("rejects negatives, odd steps and NaN", () => {
    expect(() => parseMark(-1, 10)).toThrow(); expect(() => parseMark(7.3, 10)).toThrow(); expect(() => parseMark(NaN, 10)).toThrow();
  });
});

describe("moderation maths", () => {
  it("adds the delta", () => expect(effectiveDelta(5, 1.5, 10)).toBe(1.5));
  it("never exceeds the maximum", () => expect(effectiveDelta(9, 2, 10)).toBe(1));
  it("never goes below zero", () => expect(effectiveDelta(2, -3, 10)).toBe(-2));
  it("zero clears moderation", () => expect(effectiveDelta(5, 0, 10)).toBe(0));
});

describe("export safety", () => {
  it("neutralises formula injection", () => expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\""));
  it("quotes commas", () => expect(csvCell("Das, Anita")).toBe('"Das, Anita"'));
  it("leaves plain text alone", () => expect(csvCell("Ankit Panda")).toBe("Ankit Panda"));
});

describe("unlock requests", () => {
  const row = (action, reason = null) => ({ action, reason, at: new Date() });
  it("pending after a request", () => expect(deriveUnlock([row("LOCK"), row("UNLOCK_REQUEST", "typo")]).pending).toBe(true));
  it("cleared by approval or rejection", () => {
    expect(deriveUnlock([row("LOCK"), row("UNLOCK_REQUEST", "x"), row("UNLOCK_REJECT", "no")]).pending).toBe(false);
    expect(deriveUnlock([row("LOCK"), row("UNLOCK_REQUEST", "x"), row("UNLOCK_APPROVE", "yes")]).pending).toBe(false);
  });
  it("a fresh lock clears an old request", () => expect(deriveUnlock([row("UNLOCK_REQUEST", "x"), row("LOCK")]).pending).toBe(false));
});