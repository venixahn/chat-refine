import { describe, expect, it } from "vitest";
import {
  DEFAULT_ICE_SERVERS,
  hasRelay,
  iceConfigSchema,
  parseIceServers,
} from "./ice.ts";

describe("parseIceServers", () => {
  it("uses public Google STUN when input is missing, blank, or invalid", () => {
    expect(parseIceServers(undefined)).toEqual(DEFAULT_ICE_SERVERS);
    expect(parseIceServers("")).toEqual(DEFAULT_ICE_SERVERS);
    expect(parseIceServers("   ")).toEqual(DEFAULT_ICE_SERVERS);
    expect(parseIceServers("{")).toEqual(DEFAULT_ICE_SERVERS);
    expect(parseIceServers('{"urls":"stun:lan:3478"}')).toEqual(
      DEFAULT_ICE_SERVERS,
    );
  });

  it("keeps an explicit empty list for LAN-only host candidates", () => {
    expect(parseIceServers("[]")).toEqual([]);
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

  it("keeps Google STUN next to a TURN urls array", () => {
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
    ).toEqual([
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "turn:turn.lan:3478?transport=udp",
        ],
      },
    ]);
  });
});

describe("hasRelay", () => {
  it("detects a TURN url among STUN servers", () => {
    expect(hasRelay(DEFAULT_ICE_SERVERS)).toBe(false);
    expect(hasRelay([])).toBe(false);
    expect(
      hasRelay([
        { urls: "stun:stun.l.google.com:19302" },
        { urls: ["turn:turn.lan:3478", "turns:turn.lan:5349"] },
      ]),
    ).toBe(true);
  });
});

describe("iceConfigSchema", () => {
  it("accepts an empty ICE list", () => {
    expect(iceConfigSchema.safeParse({ iceServers: [] }).success).toBe(true);
  });
});
