import { describe, it, expect } from "vitest";
import { bust, cached } from "../src/lib/cache.js";

describe("write-invalidated cache", () => {
  it("concurrent callers share one computation", async () => {
    let n = 0;
    const slow = async () => { n++; await new Promise((r) => setTimeout(r, 20)); return n; };
    const [a, b] = await Promise.all([cached("c1", "k", slow), cached("c1", "k", slow)]);
    expect(n).toBe(1);
    expect(a).toBe(b);
  });
  it("a write busts that campus's cache", async () => {
    let n = 0;
    const fn = async () => ++n;
    await cached("c2", "k", fn);
    bust("c2");
    await cached("c2", "k", fn);
    expect(n).toBe(2);
  });
});