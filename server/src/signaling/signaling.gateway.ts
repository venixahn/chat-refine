import { Inject } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from "@nestjs/websockets";
import type { IncomingMessage } from "node:http";
import {
  signalingFrameSchema,
  type SignalingFrame,
  type SignalingPeer,
} from "@chat-refine/shared";
import type { Subscription } from "rxjs";
import type { WebSocket } from "ws";
import { AuthService } from "../auth/auth.service.ts";
import type { PublicProfile } from "../db/schema.ts";
import { RoomsService } from "../rooms/rooms.service.ts";
import { SignalTicketService } from "./signal-ticket.service.ts";
import { SignalingHub } from "./signaling.hub.ts";

type Session = {
  profile: PublicProfile;
  joined: Set<string>;
  subscription: Subscription;
};

const toPeer = (profile: PublicProfile): SignalingPeer => ({
  userId: profile.id,
  username: profile.username,
  displayName: profile.displayName,
});

const send = (client: WebSocket, payload: unknown): void => {
  if (client.readyState === client.OPEN) {
    client.send(JSON.stringify(payload));
  }
};

const readJson = (raw: WebSocket.RawData): unknown => {
  try {
    return JSON.parse(String(raw));
  } catch {
    return undefined;
  }
};

@WebSocketGateway({ path: "/ws" })
export class SignalingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly sessions = new Map<WebSocket, Session>();

  constructor(
    @Inject(SignalTicketService) private readonly tickets: SignalTicketService,
    @Inject(SignalingHub) private readonly hub: SignalingHub,
    @Inject(RoomsService) private readonly rooms: RoomsService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  handleConnection(client: WebSocket, request: IncomingMessage): void {
    const ticket = new URL(
      request.url ?? "",
      "http://127.0.0.1",
    ).searchParams.get("ticket");
    const userId = ticket ? this.tickets.resolve(ticket) : undefined;
    const profile = userId ? this.auth.publicById(userId) : undefined;
    if (!profile) {
      client.close(4401, "unauthorized");
      return;
    }
    const joined = new Set<string>();
    const subscription = this.hub
      .forSession(
        profile.id,
        () => joined,
        (conversationId) => this.rooms.isMember(profile.id, conversationId),
      )
      .subscribe((envelope) => {
        send(client, envelope.event);
      });
    this.sessions.set(client, { profile, joined, subscription });
    client.on("message", (raw) => {
      this.onMessage(client, raw);
    });
  }

  handleDisconnect(client: WebSocket): void {
    const session = this.sessions.get(client);
    if (!session) {
      return;
    }
    session.subscription.unsubscribe();
    for (const conversationId of session.joined) {
      this.hub.publish({
        conversationId,
        exceptUserId: session.profile.id,
        event: {
          type: "peer-left",
          conversationId,
          userId: session.profile.id,
        },
      });
    }
    this.sessions.delete(client);
  }

  private onMessage(client: WebSocket, raw: WebSocket.RawData): void {
    const session = this.sessions.get(client);
    if (!session) {
      return;
    }
    const parsedJson = readJson(raw);
    if (parsedJson === undefined) {
      send(client, {
        type: "error",
        code: "bad-frame",
        message: "Invalid JSON",
      });
      return;
    }
    const parsed = signalingFrameSchema.safeParse(parsedJson);
    if (!parsed.success) {
      send(client, {
        type: "error",
        code: "bad-frame",
        message: "Invalid signaling frame",
      });
      return;
    }
    this.dispatchFrame(client, session, parsed.data);
  }

  private dispatchFrame(
    client: WebSocket,
    session: Session,
    frame: SignalingFrame,
  ): void {
    if (frame.type === "join") {
      this.onJoin(client, session, frame.conversationId);
      return;
    }
    if (frame.type === "leave") {
      session.joined.delete(frame.conversationId);
      this.hub.publish({
        conversationId: frame.conversationId,
        exceptUserId: session.profile.id,
        event: {
          type: "peer-left",
          conversationId: frame.conversationId,
          userId: session.profile.id,
        },
      });
      return;
    }
    if (frame.type === "activity") {
      this.onActivity(client, session, frame);
      return;
    }
    this.onRelay(client, session, frame);
  }

  private onActivity(
    client: WebSocket,
    session: Session,
    frame: Extract<SignalingFrame, { type: "activity" }>,
  ): void {
    if (!this.rooms.isMember(session.profile.id, frame.conversationId)) {
      send(client, {
        type: "error",
        code: "forbidden",
        message: "Not a member of this room",
      });
      return;
    }
    this.hub.publish({
      conversationId: frame.conversationId,
      exceptUserId: session.profile.id,
      event: {
        type: "activity",
        conversationId: frame.conversationId,
        fromUserId: session.profile.id,
        preview: frame.preview,
        createdAt: frame.createdAt,
        clientMessageId: frame.clientMessageId,
      },
    });
  }

  private onJoin(
    client: WebSocket,
    session: Session,
    conversationId: string,
  ): void {
    if (!this.rooms.isMember(session.profile.id, conversationId)) {
      send(client, {
        type: "error",
        code: "forbidden",
        message: "Not a member of this room",
      });
      return;
    }
    session.joined.add(conversationId);
    const peers = [...this.sessions.values()]
      .filter(
        (other) => other !== session && other.joined.has(conversationId),
      )
      .map((other) => toPeer(other.profile));
    send(client, { type: "joined", conversationId, peers });
    this.hub.publish({
      conversationId,
      exceptUserId: session.profile.id,
      event: {
        type: "peer-joined",
        conversationId,
        peer: toPeer(session.profile),
      },
    });
  }

  private onRelay(
    client: WebSocket,
    session: Session,
    frame: Extract<SignalingFrame, { type: "offer" | "answer" | "ice" }>,
  ): void {
    if (!session.joined.has(frame.conversationId)) {
      send(client, {
        type: "error",
        code: "not-joined",
        message: "Join the room before signaling",
      });
      return;
    }
    if (
      !this.rooms.isMember(session.profile.id, frame.conversationId) ||
      !this.rooms.isMember(frame.toUserId, frame.conversationId)
    ) {
      send(client, {
        type: "error",
        code: "forbidden",
        message: "Cannot signal this peer",
      });
      return;
    }
    this.hub.publish({
      conversationId: frame.conversationId,
      toUserId: frame.toUserId,
      event:
        frame.type === "ice"
          ? {
              type: "ice",
              conversationId: frame.conversationId,
              fromUserId: session.profile.id,
              candidate: frame.candidate,
            }
          : {
              type: frame.type,
              conversationId: frame.conversationId,
              fromUserId: session.profile.id,
              sdp: frame.sdp,
            },
    });
  }
}
