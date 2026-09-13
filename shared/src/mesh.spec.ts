import { describe, expect, it } from "vitest";
import {
  AV_MESH_CAP,
  applyCallState,
  avPeerCount,
  canAddAvPeer,
  mediaPeerIds,
  shouldIgnoreOffer,
} from "./mesh.ts";

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

describe("applyCallState", () => {
  it("upserts a peer in the call and removes them on leave", () => {
    const joined = applyCallState([], "ada", {
      inCall: true,
      audio: true,
      video: false,
    });
    expect(avPeerCount(joined)).toBe(1);
    expect(joined[0]).toEqual({ userId: "ada", audio: true, video: false });
    const muted = applyCallState(joined, "ada", {
      inCall: true,
      audio: false,
      video: false,
    });
    expect(muted[0]?.audio).toBe(false);
    expect(applyCallState(muted, "ada", { inCall: false, audio: false, video: false })).toEqual(
      [],
    );
  });
});

describe("mediaPeerIds", () => {
  it("lists in-call peers except self", () => {
    const roster = [
      { userId: "ada", audio: true, video: true },
      { userId: "bob", audio: true, video: false },
    ];
    expect(mediaPeerIds("ada", true, roster)).toEqual(["bob"]);
    expect(mediaPeerIds("ada", false, roster)).toEqual([]);
  });
});

describe("shouldIgnoreOffer", () => {
  it("drops glare only for the impolite peer", () => {
    expect(shouldIgnoreOffer(false, true)).toBe(true);
    expect(shouldIgnoreOffer(true, true)).toBe(false);
    expect(shouldIgnoreOffer(false, false)).toBe(false);
  });
});
