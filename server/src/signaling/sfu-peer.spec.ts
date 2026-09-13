import { describe, expect, it, vi } from "vitest";
import { dropForwarded, midOfTrack } from "./sfu-peer.ts";

describe("sfu peer helpers", () => {
  it("reads the mid for a forwarded track", () => {
    const track = { kind: "audio" };
    const pc = {
      getTransceivers: () => [{ sender: { track }, mid: "0" }],
    } as never;
    expect(midOfTrack(pc, track as never)).toBe("0");
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
