import { describe, expect, it } from "vitest";
import { iceConfigSchema, parseIceServers } from "./ice.ts";

describe("parseIceServers", () => {
  it("returns empty for missing or blank input", () => {
    expect(parseIceServers(undefined)).toEqual([]);
    expect(parseIceServers("")).toEqual([]);
    expect(parseIceServers("   ")).toEqual([]);
  });

  it("returns empty for invalid JSON or a non-array", () => {
    expect(parseIceServers("{")).toEqual([]);
    expect(parseIceServers('{"urls":"stun:lan:3478"}')).toEqual([]);
  });

  it("skips entries that are not ICE servers", () => {
    expect(
      parseIceServers(
        JSON.stringify([{ urls: "http://example.test" }, { urls: "" }]),
      ),
    ).toEqual([]);
  });

  it("accepts a TURN server with credentials", () => {
    const turn = {
      urls: "turn:turn.lan:3478",
      username: "chat",
      credential: "secret",
    };
    expect(parseIceServers(JSON.stringify([turn]))).toEqual([turn]);
  });

  it("accepts a urls array and drops cloud STUN from it", () => {
    expect(
      parseIceServers(
        JSON.stringify([
          {
            urls: [
              "stun:stun.l.google.com:19302",
              "turn:turn.lan:3478?transport=udp",
            ],
          },
        ]),
      ),
    ).toEqual([{ urls: ["turn:turn.lan:3478?transport=udp"] }]);
  });

  it("drops Google and Twilio ICE URLs", () => {
    expect(
      parseIceServers(
        JSON.stringify([
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478" },
          { urls: "stun:stun.lan:3478" },
        ]),
      ),
    ).toEqual([{ urls: "stun:stun.lan:3478" }]);
  });
});

describe("iceConfigSchema", () => {
  it("accepts an empty ICE list", () => {
    expect(iceConfigSchema.safeParse({ iceServers: [] }).success).toBe(true);
  });
});
