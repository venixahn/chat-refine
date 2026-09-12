import {
  p2pEventSchema,
  type P2pEvent,
  type SignalingFrame,
  type SignalingPeer,
} from "@chat-refine/shared";
import { fromEvent, type Subscription } from "rxjs";

export type Mesh = {
  offerTo: (peer: SignalingPeer) => Promise<void>;
  acceptOffer: (peer: SignalingPeer, sdp: string) => Promise<void>;
  handleAnswer: (userId: string, sdp: string) => Promise<void>;
  handleIce: (userId: string, candidate: string) => Promise<void>;
  broadcast: (event: P2pEvent) => void;
  sendTo: (userId: string, event: P2pEvent) => void;
  drop: (userId: string) => void;
  openCount: () => number;
  close: () => void;
};

type PeerLink = {
  peer: SignalingPeer;
  pc: RTCPeerConnection;
  channel?: RTCDataChannel;
  subscriptions: Subscription[];
};

const iceConfig: RTCConfiguration = { iceServers: [] };

const parseCandidate = (candidate: string): RTCIceCandidateInit | null => {
  try {
    return JSON.parse(candidate) as RTCIceCandidateInit;
  } catch {
    return null;
  }
};

export const createMesh = (input: {
  conversationId: string;
  sendSignal: (frame: SignalingFrame) => void;
  onEvent: (fromUserId: string, event: P2pEvent) => void;
  onState: () => void;
  onChannelOpen?: (userId: string) => void;
}): Mesh => {
  const peers = new Map<string, PeerLink>();
  const pendingIce = new Map<string, string[]>();

  const flushIce = async (userId: string) => {
    const link = peers.get(userId);
    const queued = pendingIce.get(userId) ?? [];
    pendingIce.delete(userId);
    if (!link?.pc.remoteDescription) {
      return;
    }
    for (const candidate of queued) {
      const parsed = parseCandidate(candidate);
      if (parsed) {
        await link.pc.addIceCandidate(parsed);
      }
    }
  };

  const bindChannel = (userId: string, channel: RTCDataChannel) => {
    const link = peers.get(userId);
    if (!link) {
      return;
    }
    link.channel = channel;
    link.subscriptions.push(
      fromEvent<MessageEvent>(channel, "message").subscribe((event) => {
        try {
          const parsed = p2pEventSchema.safeParse(JSON.parse(String(event.data)));
          if (parsed.success) {
            input.onEvent(userId, parsed.data);
          }
        } catch {
          // Ignore malformed peer payloads.
        }
      }),
    );
    channel.addEventListener("open", () => {
      input.onChannelOpen?.(userId);
      input.onState();
    });
    channel.addEventListener("close", () => input.onState());
    if (channel.readyState === "open") {
      input.onState();
    }
  };

  const drop = (userId: string) => {
    const link = peers.get(userId);
    if (!link) {
      return;
    }
    for (const subscription of link.subscriptions) {
      subscription.unsubscribe();
    }
    link.pc.close();
    peers.delete(userId);
    pendingIce.delete(userId);
    input.onState();
  };

  const ensurePc = (peer: SignalingPeer, asOfferer: boolean): PeerLink => {
    const existing = peers.get(peer.userId);
    if (existing) {
      return existing;
    }
    const pc = new RTCPeerConnection(iceConfig);
    const link: PeerLink = { peer, pc, subscriptions: [] };
    peers.set(peer.userId, link);
    link.subscriptions.push(
      fromEvent<RTCPeerConnectionIceEvent>(pc, "icecandidate").subscribe(
        (event) => {
          if (!event.candidate) {
            return;
          }
          input.sendSignal({
            type: "ice",
            conversationId: input.conversationId,
            toUserId: peer.userId,
            candidate: JSON.stringify(event.candidate.toJSON()),
          });
        },
      ),
    );
    pc.addEventListener("datachannel", (event) => {
      bindChannel(peer.userId, event.channel);
    });
    if (asOfferer) {
      bindChannel(peer.userId, pc.createDataChannel("chat"));
    }
    return link;
  };

  return {
    offerTo: async (peer) => {
      const link = ensurePc(peer, true);
      const offer = await link.pc.createOffer();
      await link.pc.setLocalDescription(offer);
      if (offer.sdp) {
        input.sendSignal({
          type: "offer",
          conversationId: input.conversationId,
          toUserId: peer.userId,
          sdp: offer.sdp,
        });
      }
    },
    acceptOffer: async (peer, sdp) => {
      if (peers.has(peer.userId)) {
        drop(peer.userId);
      }
      const link = ensurePc(peer, false);
      await link.pc.setRemoteDescription({ type: "offer", sdp });
      await flushIce(peer.userId);
      const answer = await link.pc.createAnswer();
      await link.pc.setLocalDescription(answer);
      if (answer.sdp) {
        input.sendSignal({
          type: "answer",
          conversationId: input.conversationId,
          toUserId: peer.userId,
          sdp: answer.sdp,
        });
      }
    },
    handleAnswer: async (userId, sdp) => {
      const link = peers.get(userId);
      if (!link) {
        return;
      }
      await link.pc.setRemoteDescription({ type: "answer", sdp });
      await flushIce(userId);
    },
    handleIce: async (userId, candidate) => {
      const link = peers.get(userId);
      if (!link?.pc.remoteDescription) {
        const queued = pendingIce.get(userId) ?? [];
        queued.push(candidate);
        pendingIce.set(userId, queued);
        return;
      }
      const parsed = parseCandidate(candidate);
      if (parsed) {
        await link.pc.addIceCandidate(parsed);
      }
    },
    broadcast: (event) => {
      const payload = JSON.stringify(event);
      for (const link of peers.values()) {
        if (link.channel?.readyState === "open") {
          link.channel.send(payload);
        }
      }
    },
    sendTo: (userId, event) => {
      const channel = peers.get(userId)?.channel;
      if (channel?.readyState === "open") {
        channel.send(JSON.stringify(event));
      }
    },
    drop,
    openCount: () =>
      [...peers.values()].filter((link) => link.channel?.readyState === "open")
        .length,
    close: () => {
      for (const userId of [...peers.keys()]) {
        drop(userId);
      }
    },
  };
};

export const stubPeer = (userId: string): SignalingPeer => ({
  userId,
  username: "peer",
  displayName: "Peer",
});
