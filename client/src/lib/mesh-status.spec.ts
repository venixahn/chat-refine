import { describe, expect, it } from "vitest";
import { meshStatus } from "./mesh-status.ts";

describe("meshStatus", () => {
  it("waits, connects, then counts open peers", () => {
    expect(meshStatus(0, 0)).toBe("Waiting for peers");
    expect(meshStatus(0, 2)).toBe("Connecting peers…");
    expect(meshStatus(1, 2)).toBe("Connected · 1 peer");
    expect(meshStatus(2, 2)).toBe("Connected · 2 peers");
  });
});
