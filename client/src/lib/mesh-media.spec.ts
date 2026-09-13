import { describe, expect, it, vi } from "vitest";
import {
  attachToPc,
  detachAvFromPc,
  isAvSender,
  liveRemoteStream,
  mergeRemoteTrack,
  replaceKindOnPc,
} from "./mesh-media.ts";

const sender = (kind: "audio" | "video" | "data", track: MediaStreamTrack | null) =>
  ({
    track: track ?? { kind },
    replaceTrack: vi.fn(async () => undefined),
  }) as unknown as RTCRtpSender;

describe("mesh media helpers", () => {
  it("identifies audio and video senders", () => {
    expect(isAvSender({ track: { kind: "audio" } } as RTCRtpSender)).toBe(true);
    expect(isAvSender({ track: { kind: "video" } } as RTCRtpSender)).toBe(true);
    expect(isAvSender({ track: { kind: "data" } } as RTCRtpSender)).toBe(false);
    expect(isAvSender({} as RTCRtpSender)).toBe(false);
  });

  it("replaces an existing sender and adds a missing kind", () => {
    const audio = sender("audio", { kind: "audio" } as MediaStreamTrack);
    const pc = {
      getSenders: () => [audio],
      addTrack: vi.fn(),
    } as unknown as RTCPeerConnection;
    const stream = {
      getTracks: () => [
        { kind: "audio" } as MediaStreamTrack,
        { kind: "video" } as MediaStreamTrack,
      ],
    } as MediaStream;
    attachToPc(pc, stream);
    expect(audio.replaceTrack).toHaveBeenCalled();
    expect(pc.addTrack).toHaveBeenCalledWith(stream.getTracks()[1], stream);
  });

  it("removes A/V senders without touching data", () => {
    const audio = sender("audio", { kind: "audio" } as MediaStreamTrack);
    const data = { track: { kind: "data" }, replaceTrack: vi.fn() } as unknown as RTCRtpSender;
    const pc = {
      getSenders: () => [audio, data],
      removeTrack: vi.fn(),
    } as unknown as RTCPeerConnection;
    detachAvFromPc(pc);
    expect(pc.removeTrack).toHaveBeenCalledWith(audio);
    expect(pc.removeTrack).not.toHaveBeenCalledWith(data);
  });

  it("adds a video track when no sender exists", async () => {
    const pc = {
      getSenders: () => [],
      addTrack: vi.fn(),
    } as unknown as RTCPeerConnection;
    const track = { kind: "video" } as MediaStreamTrack;
    const stream = { getTracks: () => [track] } as MediaStream;
    await replaceKindOnPc(pc, "video", track, stream);
    expect(pc.addTrack).toHaveBeenCalledWith(track, stream);
  });

  it("merges a remote track and reports liveness", () => {
    const track = { kind: "audio", readyState: "live" } as MediaStreamTrack;
    const existing = {
      getTracks: () => [] as MediaStreamTrack[],
      addTrack: vi.fn(),
    } as unknown as MediaStream;
    const event = { track, streams: [] } as unknown as RTCTrackEvent;
    expect(mergeRemoteTrack(existing, event)).toBe(existing);
    expect(existing.addTrack).toHaveBeenCalledWith(track);
    expect(liveRemoteStream({ getTracks: () => [track] } as MediaStream)).toBeTruthy();
    expect(liveRemoteStream({ getTracks: () => [] } as MediaStream)).toBeNull();
  });
});
