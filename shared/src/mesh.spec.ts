import { describe, expect, it } from "vitest";
import { AV_MESH_CAP, canAddAvPeer } from "./mesh.ts";

describe("A/V mesh cap", () => {
  it("allows peers below the cap", () => {
    expect(canAddAvPeer(0)).toBe(true);
    expect(canAddAvPeer(AV_MESH_CAP - 1)).toBe(true);
  });

  it("refuses a peer at or above the cap", () => {
    expect(canAddAvPeer(AV_MESH_CAP)).toBe(false);
    expect(canAddAvPeer(AV_MESH_CAP + 1)).toBe(false);
  });
});
