import { describe, expect, it } from "vitest";
import { readConfig } from "../server/config.js";

describe("deployment configuration", () => {
  it("uses explicit defaults and the hosting platform port", () => {
    expect(readConfig({})).toEqual({
      port: 3000,
      roomTtlMs: 1800000,
      publicOrigin: undefined,
    });
    expect(readConfig({ PORT: "10000", ROOM_TTL_MS: "5000" })).toMatchObject({
      port: 10000,
      roomTtlMs: 5000,
    });
  });
  it.each(["0", "-1", "NaN", "3000.5", "65536"])(
    "rejects invalid PORT %s",
    (value) => {
      expect(() => readConfig({ PORT: value })).toThrow("PORT");
    },
  );
  it.each(["-1", "0", "Infinity", "oops"])(
    "rejects invalid room TTL %s",
    (value) => {
      expect(() => readConfig({ ROOM_TTL_MS: value })).toThrow("ROOM_TTL_MS");
    },
  );
  it("uses Render HTTPS origin and lets a custom domain override it", () => {
    expect(
      readConfig({ RENDER_EXTERNAL_URL: "https://vault-rush.onrender.com/" })
        .publicOrigin,
    ).toBe("https://vault-rush.onrender.com");
    expect(
      readConfig({
        RENDER_EXTERNAL_URL: "https://vault-rush.onrender.com",
        PUBLIC_ORIGIN: "https://play.example.com/",
      }).publicOrigin,
    ).toBe("https://play.example.com");
  });
  it.each([
    "bad",
    "ftp://example.com",
    "https://user:pass@example.com",
    "https://example.com/path",
    "https://example.com/?x=1",
    "https://example.com/#token",
  ])("rejects invalid public origin %s", (value) => {
    expect(() => readConfig({ PUBLIC_ORIGIN: value })).toThrow("PUBLIC_ORIGIN");
  });
});
