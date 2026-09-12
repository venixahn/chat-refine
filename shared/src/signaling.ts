import { z } from "zod";

export const signalingFrameSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("join"),
    conversationId: z.string().min(1),
  }),
  z.object({
    type: z.literal("leave"),
    conversationId: z.string().min(1),
  }),
  z.object({
    type: z.literal("offer"),
    conversationId: z.string().min(1),
    toUserId: z.string().min(1),
    sdp: z.string().min(1),
  }),
  z.object({
    type: z.literal("answer"),
    conversationId: z.string().min(1),
    toUserId: z.string().min(1),
    sdp: z.string().min(1),
  }),
  z.object({
    type: z.literal("ice"),
    conversationId: z.string().min(1),
    toUserId: z.string().min(1),
    candidate: z.string().min(1),
  }),
]);

export type SignalingFrame = z.infer<typeof signalingFrameSchema>;

export const signalingPeerSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().min(1),
});

export type SignalingPeer = z.infer<typeof signalingPeerSchema>;

export const signalingEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("joined"),
    conversationId: z.string().min(1),
    peers: z.array(signalingPeerSchema),
  }),
  z.object({
    type: z.literal("peer-joined"),
    conversationId: z.string().min(1),
    peer: signalingPeerSchema,
  }),
  z.object({
    type: z.literal("peer-left"),
    conversationId: z.string().min(1),
    userId: z.string().min(1),
  }),
  z.object({
    type: z.literal("offer"),
    conversationId: z.string().min(1),
    fromUserId: z.string().min(1),
    sdp: z.string().min(1),
  }),
  z.object({
    type: z.literal("answer"),
    conversationId: z.string().min(1),
    fromUserId: z.string().min(1),
    sdp: z.string().min(1),
  }),
  z.object({
    type: z.literal("ice"),
    conversationId: z.string().min(1),
    fromUserId: z.string().min(1),
    candidate: z.string().min(1),
  }),
  z.object({
    type: z.literal("error"),
    code: z.enum(["forbidden", "bad-frame", "not-joined"]),
    message: z.string().min(1),
  }),
]);

export type SignalingEvent = z.infer<typeof signalingEventSchema>;

const chatLineSchema = z.object({
  clientMessageId: z.string().min(8),
  conversationId: z.string().min(1),
  body: z.string().min(1).max(4000),
  createdAt: z.string().min(1),
  fromUserId: z.string().min(1),
});

export const p2pEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message"),
    clientMessageId: z.string().min(8),
    conversationId: z.string().min(1),
    body: z.string().min(1).max(4000),
    createdAt: z.string().min(1),
  }),
  z.object({
    type: z.literal("typing"),
    conversationId: z.string().min(1),
  }),
  z.object({
    type: z.literal("history_request"),
    conversationId: z.string().min(1),
  }),
  z.object({
    type: z.literal("history_batch"),
    conversationId: z.string().min(1),
    messages: z.array(chatLineSchema).max(200),
  }),
  z.object({
    type: z.literal("call-state"),
    conversationId: z.string().min(1),
    inCall: z.boolean(),
    audio: z.boolean(),
    video: z.boolean(),
  }),
]);

export type P2pEvent = z.infer<typeof p2pEventSchema>;
