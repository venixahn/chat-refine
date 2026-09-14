import { describe, expect, it, vi } from "vitest";
import { dropForwarded, hasForwarded, midOfTrack, receiverOf } from "./sfu-peer.ts";

describe("sfu peer helpers", () => {
  it("finds the receiver for a specific inbound track", () => {
    const wanted = { kind: "video" };
    const other = { kind: "video" };
    const match = { kind: "video", receiver: { track: wanted } };
    const pc = {
      getTransceivers: () => [
        { kind: "video", receiver: { track: other } },
        match,
      ],
    } as never;
    expect(receiverOf(pc, wanted as never)).toBe(match);
  });

  it("reads the mid for a forwarded track", () => {
    const track = { kind: "audio" };
    const pc = {
      getTransceivers: () => [{ sender: { track }, mid: "0" }],
    } as never;
    expect(midOfTrack(pc, track as never)).toBe("0");
  });

  it("detects a sender already forwarding a track", () => {
    const track = { kind: "audio" };
    const pc = {
      getSenders: () => [{ track }],
    } as never;
    expect(hasForwarded(pc, track as never)).toBe(true);
  });

  it("removes senders that forward the given tracks", () => {
    const track = { kind: "video" };
    const sender = { track };
    const other = { track: { kind: "audio" } };
    const pc = {
      getSenders: () => [sender, other],
      removeTrack: vi.fn(),
    } as never;
    dropForwarded(pc, [track as never]);
    expect((pc as { removeTrack: ReturnType<typeof vi.fn> }).removeTrack).toHaveBeenCalledWith(
      sender,
    );
  });
});
