import { Inject } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from "@nestjs/websockets";
import type { IncomingMessage } from "node:http";
import {
  AV_MESH_CAP,
  isSfuFrame,
  signalingFrameSchema,
  type SignalingFrame,
  type SignalingPeer,
} from "@chat-refine/shared";
import type { Subscription } from "rxjs";
import type { WebSocket } from "ws";
import { AuthService } from "../auth/auth.service.ts";
import type { PublicProfile } from "../db/schema.ts";
import { RoomsService } from "../rooms/rooms.service.ts";
import { CallRosterService } from "./call-roster.service.ts";
import { SfuService } from "./sfu.service.ts";
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
    @Inject(CallRosterService) private readonly calls: CallRosterService,
    @Inject(SfuService) private readonly sfu: SfuService,
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
    for (const conversationId of [...session.joined]) {
      this.leaveRoom(session, conversationId);
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
      this.leaveRoom(session, frame.conversationId);
      return;
    }
    if (frame.type === "activity") {
      this.onActivity(client, session, frame);
      return;
    }
    if (frame.type === "call-state") {
      this.onCallState(client, session, frame);
      return;
    }
    if (isSfuFrame(frame)) {
      this.onSfu(client, session, frame);
      return;
    }
    this.onRelay(client, session, frame);
  }

  private leaveRoom(session: Session, conversationId: string): void {
    session.joined.delete(conversationId);
    void this.sfu.leave(conversationId, session.profile.id);
    this.publishCallDrop(session.profile.id, conversationId);
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

  private publishCallDrop(userId: string, conversationId: string): void {
    const updates = this.calls.dropUser(userId, [conversationId]);
    for (const update of updates) {
      this.hub.publish({
        conversationId: update.conversationId,
        exceptUserId: userId,
        event: {
          type: "call-state",
          conversationId: update.conversationId,
          fromUserId: userId,
          inCall: false,
          audio: false,
          video: false,
        },
      });
    }
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
    send(client, {
      type: "joined",
      conversationId,
      peers,
      call: this.calls.snapshot(conversationId),
    });
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

  private onCallState(
    client: WebSocket,
    session: Session,
    frame: Extract<SignalingFrame, { type: "call-state" }>,
  ): void {
    if (!session.joined.has(frame.conversationId)) {
      send(client, {
        type: "error",
        code: "not-joined",
        message: "Join the room before signaling",
      });
      return;
    }
    if (!this.rooms.isMember(session.profile.id, frame.conversationId)) {
      send(client, {
        type: "error",
        code: "forbidden",
        message: "Not a member of this room",
      });
      return;
    }
    this.commitCallState(client, session, frame);
  }

  private commitCallState(
    client: WebSocket,
    session: Session,
    frame: Extract<SignalingFrame, { type: "call-state" }>,
  ): void {
    const result = this.calls.apply(frame.conversationId, session.profile.id, {
      inCall: frame.inCall,
      audio: frame.audio,
      video: frame.video,
    });
    if (!result.ok) {
      send(client, {
        type: "error",
        code: "call-full",
        message: `Call is full (${AV_MESH_CAP} peers)`,
      });
      return;
    }
    if (!frame.inCall) {
      void this.sfu.leave(frame.conversationId, session.profile.id);
    }
    if (!result.changed) {
      return;
    }
    this.hub.publish({
      conversationId: frame.conversationId,
      exceptUserId: session.profile.id,
      event: {
        type: "call-state",
        conversationId: frame.conversationId,
        fromUserId: session.profile.id,
        inCall: frame.inCall,
        audio: frame.audio,
        video: frame.video,
      },
    });
  }

  private onSfu(
    client: WebSocket,
    session: Session,
    frame: Extract<SignalingFrame, { type: "sfu-offer" | "sfu-answer" | "sfu-ice" }>,
  ): void {
    if (!session.joined.has(frame.conversationId)) {
      send(client, {
        type: "error",
        code: "not-joined",
        message: "Join the room before signaling",
      });
      return;
    }
    if (!this.rooms.isMember(session.profile.id, frame.conversationId)) {
      send(client, {
        type: "error",
        code: "forbidden",
        message: "Not a member of this room",
      });
      return;
    }
    void this.dispatchSfu(session.profile.id, frame);
  }

  private async dispatchSfu(
    userId: string,
    frame: Extract<SignalingFrame, { type: "sfu-offer" | "sfu-answer" | "sfu-ice" }>,
  ): Promise<void> {
    try {
      await this.runSfu(userId, frame);
    } catch {
      // Drop a failed SFU negotiation; the client can offer again.
    }
  }

  private runSfu(
    userId: string,
    frame: Extract<SignalingFrame, { type: "sfu-offer" | "sfu-answer" | "sfu-ice" }>,
  ): Promise<void> {
    if (frame.type === "sfu-offer") {
      return this.sfu.handleOffer(frame.conversationId, userId, frame.sdp);
    }
    if (frame.type === "sfu-answer") {
      return this.sfu.handleAnswer(frame.conversationId, userId, frame.sdp);
    }
    return this.sfu.handleIce(frame.conversationId, userId, frame.candidate);
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
