import {
  sfuSubscribers,
  type IceServer,
  type SignalingEvent,
} from "@chat-refine/shared";
import type { MediaStreamTrack } from "werift";
import { createExclusive, type Exclusive } from "./sfu-lock.ts";
import {
  armPli,
  closeEndpoint,
  createSfuPeer,
  dropForwarded,
  hasForwarded,
  midOfTrack,
  type SfuEndpoint,
} from "./sfu-peer.ts";

export type SfuEmit = (toUserId: string, event: SignalingEvent) => void;

export class SfuRoom {
  private readonly members = new Map<string, SfuEndpoint>();
  private readonly locks = new Map<string, Exclusive>();
  private readonly retryOffer = new Set<string>();

  constructor(
    private readonly conversationId: string,
    private readonly iceServers: IceServer[],
    private readonly emit: SfuEmit,
  ) {}

  empty(): boolean {
    return this.members.size === 0;
  }

  handleOffer(userId: string, sdp: string): Promise<void> {
    return this.exclusive(userId)(() => this.acceptOffer(userId, sdp));
  }

  handleAnswer(userId: string, sdp: string): Promise<void> {
    return this.exclusive(userId)(() => this.acceptAnswer(userId, sdp));
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
    this.retryOffer.delete(userId);
    const tracks = [...endpoint.inbound];
    await this.exclusive(userId)(async () => {
      this.members.delete(userId);
      await closeEndpoint(endpoint);
    });
    this.locks.delete(userId);
    await this.retract(tracks);
  }

  private exclusive(userId: string): Exclusive {
    const existing = this.locks.get(userId);
    if (existing) {
      return existing;
    }
    const created = createExclusive();
    this.locks.set(userId, created);
    return created;
  }

  private async acceptOffer(userId: string, sdp: string): Promise<void> {
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
    await this.flushOffer(userId);
  }

  private async acceptAnswer(userId: string, sdp: string): Promise<void> {
    const endpoint = this.members.get(userId);
    if (!endpoint || endpoint.pc.signalingState !== "have-local-offer") {
      return;
    }
    await endpoint.pc.setRemoteDescription({ type: "answer", sdp });
    await this.flushOffer(userId);
  }

  private async retract(tracks: MediaStreamTrack[]): Promise<void> {
    for (const [otherId, other] of this.members) {
      await this.exclusive(otherId)(async () => {
        dropForwarded(other.pc, tracks);
        await this.offerTo(otherId, other);
      });
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
    try {
      await this.forwardTrack(fromUserId, track);
    } catch {
      // A stale offer must not take down Nest.
    }
  }

  private async forwardTrack(
    fromUserId: string,
    track: MediaStreamTrack,
  ): Promise<void> {
    const others = sfuSubscribers(fromUserId, [...this.members.keys()]);
    for (const otherId of others) {
      await this.exclusive(otherId)(() =>
        this.subscribe(otherId, fromUserId, track),
      );
    }
  }

  private async subscribe(
    otherId: string,
    fromUserId: string,
    track: MediaStreamTrack,
  ): Promise<void> {
    const other = this.members.get(otherId);
    if (!other || !this.members.has(fromUserId) || hasForwarded(other.pc, track)) {
      return;
    }
    other.pc.addTrack(track);
    this.queueOffer(otherId);
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
        if (hasForwarded(endpoint.pc, track)) {
          continue;
        }
        endpoint.pc.addTrack(track);
        added = true;
      }
    }
    if (added) {
      this.retryOffer.add(userId);
    }
  }

  private queueOffer(userId: string): void {
    this.retryOffer.add(userId);
    void this.exclusive(userId)(() => this.flushOffer(userId));
  }

  private async flushOffer(userId: string): Promise<void> {
    const endpoint = this.members.get(userId);
    if (!endpoint || !this.retryOffer.delete(userId)) {
      return;
    }
    await this.offerTo(userId, endpoint);
  }

  private async offerTo(userId: string, endpoint: SfuEndpoint): Promise<void> {
    if (endpoint.pc.signalingState !== "stable") {
      this.retryOffer.add(userId);
      return;
    }
    const offer = await endpoint.pc.createOffer();
    if (endpoint.pc.signalingState !== "stable") {
      this.retryOffer.add(userId);
      return;
    }
    try {
      await endpoint.pc.setLocalDescription(offer);
    } catch {
      this.retryOffer.add(userId);
      return;
    }
    this.publishForwardedRoutes(userId, endpoint);
    if (offer.sdp) {
      this.emit(userId, {
        type: "sfu-offer",
        conversationId: this.conversationId,
        sdp: offer.sdp,
      });
    }
  }

  private ownerOf(track: MediaStreamTrack): string | undefined {
    for (const [userId, member] of this.members) {
      if (member.inbound.includes(track)) {
        return userId;
      }
    }
    return undefined;
  }

  private publishForwardedRoutes(
    toUserId: string,
    endpoint: SfuEndpoint,
  ): void {
    for (const sender of endpoint.pc.getSenders()) {
      const track = sender.track;
      if (!track) {
        continue;
      }
      const fromUserId = this.ownerOf(track);
      if (fromUserId) {
        this.publishRoute(toUserId, fromUserId, endpoint, track);
      }
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
