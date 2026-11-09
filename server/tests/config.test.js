import { describe, it, expect, afterEach } from "vitest";
import { publicOrigin } from "../src/config.js";

describe("publicOrigin", () => {
  afterEach(() => { delete process.env.CLIENT_ORIGIN; });
  it("keeps a clean origin", () => {
    process.env.CLIENT_ORIGIN = "https://sutra.vercel.app";
    expect(publicOrigin()).toBe("https://sutra.vercel.app");
  });
  it("drops a pasted path or trailing slash", () => {
    process.env.CLIENT_ORIGIN = "https://sutra.vercel.app/login";
    expect(publicOrigin()).toBe("https://sutra.vercel.app");
    process.env.CLIENT_ORIGIN = "https://sutra.vercel.app/";
    expect(publicOrigin()).toBe("https://sutra.vercel.app");
  });
  it("works for local development", () => {
    process.env.CLIENT_ORIGIN = "http://localhost:5173";
    expect(publicOrigin()).toBe("http://localhost:5173");
  });
  it("is empty when unset", () => expect(publicOrigin()).toBe(""));
});