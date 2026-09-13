import { describe, expect, it } from "vitest";
import {
  p2pEventSchema,
  signalingEventSchema,
  signalingFrameSchema,
} from "./signaling.ts";

describe("signalingFrameSchema", () => {
  it("accepts a join frame", () => {
    expect(
      signalingFrameSchema.safeParse({
        type: "join",
        conversationId: "room-general",
      }).success,
    ).toBe(true);
  });

  it("accepts an sfu-offer frame", () => {
    expect(
      signalingFrameSchema.safeParse({
        type: "sfu-offer",
        conversationId: "room-general",
        sdp: "v=0",
      }).success,
    ).toBe(true);
  });

  it("accepts a call-state frame", () => {
    expect(
      signalingFrameSchema.safeParse({
        type: "call-state",
        conversationId: "room-general",
        inCall: true,
        audio: true,
        video: false,
      }).success,
    ).toBe(true);
  });

  it("accepts an activity frame", () => {
    expect(
      signalingFrameSchema.safeParse({
        type: "activity",
        conversationId: "room-general",
        preview: "hello",
        createdAt: "2026-09-13T12:00:00.000Z",
        clientMessageId: "msg-ada-01",
      }).success,
    ).toBe(true);
  });

  it("rejects an offer without sdp", () => {
    expect(
      signalingFrameSchema.safeParse({
        type: "offer",
        conversationId: "room-general",
        toUserId: "user-1",
      }).success,
    ).toBe(false);
  });
});

describe("p2pEventSchema", () => {
  it("accepts a text message", () => {
    expect(
      p2pEventSchema.safeParse({
        type: "message",
        clientMessageId: "msg-ada-1",
        conversationId: "room-general",
        body: "hello",
        createdAt: "2026-09-12T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("accepts a call-state event", () => {
    expect(
      p2pEventSchema.safeParse({
        type: "call-state",
        conversationId: "room-general",
        inCall: true,
        audio: true,
        video: false,
      }).success,
    ).toBe(true);
  });

  it("accepts a file-only message", () => {
    expect(
      p2pEventSchema.safeParse({
        type: "message",
        clientMessageId: "msg-ada-1",
        conversationId: "room-general",
        body: "",
        createdAt: "2026-09-12T00:00:00.000Z",
        attachment: {
          name: "dot.png",
          mime: "image/png",
          size: 70,
          data: "a".repeat(16),
        },
      }).success,
    ).toBe(true);
  });

  it("rejects a message without an id", () => {
    expect(
      p2pEventSchema.safeParse({
        type: "message",
        conversationId: "room-general",
        body: "hello",
        createdAt: "2026-09-12T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});

describe("signalingEventSchema", () => {
  it("accepts a joined roster", () => {
    const parsed = signalingEventSchema.safeParse({
      type: "joined",
      conversationId: "room-general",
      peers: [
        { userId: "u1", username: "ada", displayName: "Ada" },
      ],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.type === "joined") {
      expect(parsed.data.call).toEqual([]);
    }
  });

  it("accepts an sfu-route event", () => {
    expect(
      signalingEventSchema.safeParse({
        type: "sfu-route",
        conversationId: "room-general",
        fromUserId: "ada",
        mid: "1",
        kind: "video",
      }).success,
    ).toBe(true);
  });

  it("accepts a call-state event", () => {
    expect(
      signalingEventSchema.safeParse({
        type: "call-state",
        conversationId: "room-general",
        fromUserId: "ada",
        inCall: true,
        audio: true,
        video: true,
      }).success,
    ).toBe(true);
  });

  it("rejects an offer missing fromUserId", () => {
    expect(
      signalingEventSchema.safeParse({
        type: "offer",
        conversationId: "room-general",
        sdp: "v=0",
      }).success,
    ).toBe(false);
  });
});

