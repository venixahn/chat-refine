import {
  sfuSubscribers,
  type IceServer,
  type SignalingEvent,
} from "@chat-refine/shared";
import type { MediaStreamTrack } from "werift";
import {
  armPli,
  closeEndpoint,
  createSfuPeer,
  dropForwarded,
  midOfTrack,
  type SfuEndpoint,
} from "./sfu-peer.ts";

export type SfuEmit = (toUserId: string, event: SignalingEvent) => void;

export class SfuRoom {
  private readonly members = new Map<string, SfuEndpoint>();
  private readonly retryOffer = new Set<string>();

  constructor(
    private readonly conversationId: string,
    private readonly iceServers: IceServer[],
    private readonly emit: SfuEmit,
  ) {}

  empty(): boolean {
    return this.members.size === 0;
  }

  async handleOffer(userId: string, sdp: string): Promise<void> {
    const endpoint = this.ensure(userId);
    await endpoint.pc.setRemoteDescription({ type: "offer", sdp });
    const answer = await endpoint.pc.createAnswer();
    await endpoint.pc.setLocalDescription(answer);
    if (answer.sdp) {
      this.emit(userId, {
        type: "sfu-answer",
        conversationId: this.conversationId,
        sdp: answer.sdp,
      });
    }
    await this.forwardExisting(userId, endpoint);
  }

  async handleAnswer(userId: string, sdp: string): Promise<void> {
    const endpoint = this.members.get(userId);
    if (!endpoint || endpoint.pc.signalingState !== "have-local-offer") {
      return;
    }
    await endpoint.pc.setRemoteDescription({ type: "answer", sdp });
    if (this.retryOffer.delete(userId)) {
      await this.offerTo(userId, endpoint);
    }
  }

  async handleIce(userId: string, candidate: string): Promise<void> {
    const endpoint = this.members.get(userId);
    if (!endpoint) {
      return;
    }
    try {
      await endpoint.pc.addIceCandidate(JSON.parse(candidate) as object);
    } catch {
      // Drop malformed trickle ICE.
    }
  }

  async leave(userId: string): Promise<void> {
    const endpoint = this.members.get(userId);
    if (!endpoint) {
      return;
    }
    this.members.delete(userId);
    this.retryOffer.delete(userId);
    const tracks = [...endpoint.inbound];
    await closeEndpoint(endpoint);
    await this.retract(tracks);
  }

  private async retract(tracks: MediaStreamTrack[]): Promise<void> {
    for (const [otherId, other] of this.members) {
      dropForwarded(other.pc, tracks);
      await this.offerTo(otherId, other);
    }
  }

  private ensure(userId: string): SfuEndpoint {
    const existing = this.members.get(userId);
    if (existing) {
      return existing;
    }
    const inbound: MediaStreamTrack[] = [];
    const timers: ReturnType<typeof setInterval>[] = [];
    const pc = createSfuPeer(this.iceServers, {
      onIce: (candidate) => {
        this.emit(userId, {
          type: "sfu-ice",
          conversationId: this.conversationId,
          candidate,
        });
      },
      onTrack: (track) => {
        inbound.push(track);
        armPli(pc, track, timers);
        void this.fanOut(userId, track);
      },
    });
    const endpoint = { pc, inbound, timers };
    this.members.set(userId, endpoint);
    return endpoint;
  }

  private async fanOut(
    fromUserId: string,
    track: MediaStreamTrack,
  ): Promise<void> {
    const others = sfuSubscribers(fromUserId, [...this.members.keys()]);
    for (const otherId of others) {
      const other = this.members.get(otherId);
      if (!other) {
        continue;
      }
      other.pc.addTrack(track);
      this.publishRoute(otherId, fromUserId, other, track);
      await this.offerTo(otherId, other);
    }
  }

  private async forwardExisting(
    userId: string,
    endpoint: SfuEndpoint,
  ): Promise<void> {
    let added = false;
    for (const [otherId, other] of this.members) {
      if (otherId === userId) {
        continue;
      }
      for (const track of other.inbound) {
        endpoint.pc.addTrack(track);
        this.publishRoute(userId, otherId, endpoint, track);
        added = true;
      }
    }
    if (added) {
      await this.offerTo(userId, endpoint);
    }
  }

  private async offerTo(userId: string, endpoint: SfuEndpoint): Promise<void> {
    if (endpoint.pc.signalingState !== "stable") {
      this.retryOffer.add(userId);
      return;
    }
    const offer = await endpoint.pc.createOffer();
    await endpoint.pc.setLocalDescription(offer);
    if (offer.sdp) {
      this.emit(userId, {
        type: "sfu-offer",
        conversationId: this.conversationId,
        sdp: offer.sdp,
      });
    }
  }

  private publishRoute(
    toUserId: string,
    fromUserId: string,
    endpoint: SfuEndpoint,
    track: MediaStreamTrack,
  ): void {
    const mid = midOfTrack(endpoint.pc, track);
    const kind = track.kind;
    if (!mid || (kind !== "audio" && kind !== "video")) {
      return;
    }
    this.emit(toUserId, {
      type: "sfu-route",
      conversationId: this.conversationId,
      fromUserId,
      mid,
      kind,
    });
  }
}
