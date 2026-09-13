import { Inject, Injectable } from "@nestjs/common";
import { parseIceServers } from "@chat-refine/shared";
import { SfuRoom } from "./sfu-room.ts";
import { SignalingHub } from "./signaling.hub.ts";

@Injectable()
export class SfuService {
  private readonly rooms = new Map<string, SfuRoom>();

  constructor(@Inject(SignalingHub) private readonly hub: SignalingHub) {}

  handleOffer(conversationId: string, userId: string, sdp: string): Promise<void> {
    return this.room(conversationId).handleOffer(userId, sdp);
  }

  handleAnswer(conversationId: string, userId: string, sdp: string): Promise<void> {
    return this.room(conversationId).handleAnswer(userId, sdp);
  }

  handleIce(
    conversationId: string,
    userId: string,
    candidate: string,
  ): Promise<void> {
    return this.room(conversationId).handleIce(userId, candidate);
  }

  async leave(conversationId: string, userId: string): Promise<void> {
    const room = this.rooms.get(conversationId);
    if (!room) {
      return;
    }
    await room.leave(userId);
    if (room.empty()) {
      this.rooms.delete(conversationId);
    }
  }

  private room(conversationId: string): SfuRoom {
    const existing = this.rooms.get(conversationId);
    if (existing) {
      return existing;
    }
    const created = new SfuRoom(
      conversationId,
      parseIceServers(process.env.ICE_SERVERS),
      (toUserId, event) => {
        this.hub.publish({ conversationId, toUserId, event });
      },
    );
    this.rooms.set(conversationId, created);
    return created;
  }
}
