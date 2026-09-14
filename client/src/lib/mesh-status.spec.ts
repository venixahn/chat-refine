import { describe, expect, it } from "vitest";
import {
  ICE_STALL_MS,
  iceStalled,
  meshStatus,
  stallHint,
} from "./mesh-status.ts";

describe("meshStatus", () => {
  it("waits, connects, then counts open peers", () => {
    expect(meshStatus(0, 0)).toBe("Waiting for peers");
    expect(meshStatus(0, 2)).toBe("Connecting peers…");
    expect(meshStatus(1, 2)).toBe("Connected · 1 peer");
    expect(meshStatus(2, 2)).toBe("Connected · 2 peers");
  });
});

describe("iceStalled", () => {
  const started = 1_000;

  it("is false while a data channel is open", () => {
    expect(
      iceStalled(1, [{ ice: "failed", startedAt: started }], started + ICE_STALL_MS),
    ).toBe(false);
  });

  it("is true when ICE fails or checking runs long", () => {
    expect(
      iceStalled(0, [{ ice: "failed", startedAt: started }], started + 10),
    ).toBe(true);
    expect(
      iceStalled(0, [{ ice: "disconnected", startedAt: started }], started + 10),
    ).toBe(true);
    expect(
      iceStalled(0, [{ ice: "checking", startedAt: started }], started + ICE_STALL_MS),
    ).toBe(true);
    expect(
      iceStalled(0, [{ ice: "checking", startedAt: started }], started + 100),
    ).toBe(false);
  });
});

describe("stallHint", () => {
  it("asks for a relay only when none is configured", () => {
    expect(stallHint(true)).toBe("Still trying from this network.");
    expect(stallHint(false)).toBe(
      "Still trying from this network. Ask the host to add a relay.",
    );
  });
});
