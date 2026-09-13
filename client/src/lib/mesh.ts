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
  attachLocalStream: (stream: MediaStream) => Promise<void>;
  detachLocalStream: () => Promise<void>;
  replaceMediaTrack: (
    kind: "audio" | "video",
    track: MediaStreamTrack | null,
  ) => Promise<void>;
  renegotiate: (userId?: string) => Promise<void>;
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

const parseCandidate = (candidate: string): RTCIceCandidateInit | null => {
  try {
    return JSON.parse(candidate) as RTCIceCandidateInit;
  } catch {
    return null;
  }
};

const isAvSender = (sender: RTCRtpSender) =>
  sender.track?.kind === "audio" || sender.track?.kind === "video";

export const createMesh = (input: {
  conversationId: string;
  selfId: string;
  sendSignal: (frame: SignalingFrame) => void;
  onEvent: (fromUserId: string, event: P2pEvent) => void;
  onState: () => void;
  onChannelOpen?: (userId: string) => void;
  onRemoteStream?: (userId: string, stream: MediaStream | null) => void;
  iceServers?: RTCIceServer[];
}): Mesh => {
  const iceConfig: RTCConfiguration = { iceServers: input.iceServers ?? [] };
  const peers = new Map<string, PeerLink>();
  const pendingIce = new Map<string, string[]>();
  const makingOffer = new Set<string>();
  let localStream: MediaStream | null = null;

  const politeToward = (peerId: string) => input.selfId > peerId;

  const addQueuedIce = async (pc: RTCPeerConnection, queued: string[]) => {
    for (const candidate of queued) {
      const parsed = parseCandidate(candidate);
      if (!parsed) {
        continue;
      }
      await pc.addIceCandidate(parsed);
    }
  };

  const flushIce = async (userId: string) => {
    const link = peers.get(userId);
    const queued = pendingIce.get(userId) ?? [];
    pendingIce.delete(userId);
    if (!link?.pc.remoteDescription) {
      return;
    }
    await addQueuedIce(link.pc, queued);
  };

  const sendOffer = (peer: SignalingPeer, sdp: string) => {
    input.sendSignal({
      type: "offer",
      conversationId: input.conversationId,
      toUserId: peer.userId,
      sdp,
    });
  };

  const sendAnswer = (peer: SignalingPeer, sdp: string) => {
    input.sendSignal({
      type: "answer",
      conversationId: input.conversationId,
      toUserId: peer.userId,
      sdp,
    });
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

  const attachToPc = (pc: RTCPeerConnection, stream: MediaStream) => {
    for (const track of stream.getTracks()) {
      const sender = pc.getSenders().find((item) => item.track?.kind === track.kind);
      if (sender) {
        void sender.replaceTrack(track);
      } else {
        pc.addTrack(track, stream);
      }
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
    makingOffer.delete(userId);
    input.onRemoteStream?.(userId, null);
    input.onState();
  };

  const createOfferFor = async (link: PeerLink) => {
    if (link.pc.signalingState !== "stable") {
      return;
    }
    makingOffer.add(link.peer.userId);
    try {
      const offer = await link.pc.createOffer();
      if (link.pc.signalingState !== "stable") {
        return;
      }
      await link.pc.setLocalDescription(offer);
      if (offer.sdp) {
        sendOffer(link.peer, offer.sdp);
      }
    } finally {
      makingOffer.delete(link.peer.userId);
    }
  };

  const publishRemoteTrack = (peerId: string, event: RTCTrackEvent) => {
    const stream = event.streams[0] ?? new MediaStream([event.track]);
    const publish = () => {
      const live = stream.getTracks().some((track) => track.readyState === "live");
      input.onRemoteStream?.(peerId, live ? stream : null);
    };
    event.track.addEventListener("ended", publish);
    publish();
  };

  const wirePeerConnection = (peer: SignalingPeer, pc: RTCPeerConnection, link: PeerLink) => {
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
    pc.addEventListener("track", (event) => {
      publishRemoteTrack(peer.userId, event);
    });
  };

  const liveLink = (peer: SignalingPeer): PeerLink | undefined => {
    const existing = peers.get(peer.userId);
    if (existing?.pc.connectionState === "closed") {
      drop(peer.userId);
      return undefined;
    }
    return existing;
  };

  const ensurePc = (peer: SignalingPeer, asOfferer: boolean): PeerLink => {
    const existing = liveLink(peer);
    if (existing) {
      return existing;
    }
    const pc = new RTCPeerConnection(iceConfig);
    const link: PeerLink = { peer, pc, subscriptions: [] };
    peers.set(peer.userId, link);
    wirePeerConnection(peer, pc, link);
    if (localStream) {
      attachToPc(pc, localStream);
    }
    if (asOfferer) {
      bindChannel(peer.userId, pc.createDataChannel("chat"));
    }
    return link;
  };

  const rollbackIfNeeded = async (link: PeerLink): Promise<boolean> => {
    const glare =
      makingOffer.has(link.peer.userId) || link.pc.signalingState !== "stable";
    if (!glare) {
      return true;
    }
    if (!politeToward(link.peer.userId)) {
      return false;
    }
    try {
      await link.pc.setLocalDescription({ type: "rollback" });
      return true;
    } catch {
      return false;
    }
  };

  const answerOffer = async (link: PeerLink, sdp: string) => {
    const ready = await rollbackIfNeeded(link);
    if (!ready) {
      return;
    }
    await link.pc.setRemoteDescription({ type: "offer", sdp });
    await flushIce(link.peer.userId);
    const answer = await link.pc.createAnswer();
    await link.pc.setLocalDescription(answer);
    if (answer.sdp) {
      sendAnswer(link.peer, answer.sdp);
    }
  };

  return {
    offerTo: async (peer) => {
      const link = ensurePc(peer, true);
      await createOfferFor(link);
    },
    acceptOffer: async (peer, sdp) => {
      const existing = peers.get(peer.userId);
      if (existing && existing.pc.connectionState !== "closed") {
        await answerOffer(existing, sdp);
        return;
      }
      const link = ensurePc(peer, false);
      await answerOffer(link, sdp);
    },
    handleAnswer: async (userId, sdp) => {
      const link = peers.get(userId);
      if (!link) {
        return;
      }
      if (link.pc.signalingState !== "have-local-offer") {
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
    attachLocalStream: async (stream) => {
      localStream = stream;
      for (const link of peers.values()) {
        attachToPc(link.pc, stream);
      }
    },
    detachLocalStream: async () => {
      localStream = null;
      for (const link of peers.values()) {
        for (const sender of link.pc.getSenders()) {
          if (isAvSender(sender)) {
            link.pc.removeTrack(sender);
          }
        }
      }
    },
    replaceMediaTrack: async (kind, track) => {
      for (const link of peers.values()) {
        const sender = link.pc.getSenders().find((item) => item.track?.kind === kind);
        if (sender) {
          await sender.replaceTrack(track);
        }
      }
    },
    renegotiate: async (userId) => {
      const links = userId
        ? ([peers.get(userId)].filter(Boolean) as PeerLink[])
        : [...peers.values()];
      for (const link of links) {
        await createOfferFor(link);
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
      localStream = null;
      for (const id of [...peers.keys()]) {
        drop(id);
      }
    },
  };
};

export const stubPeer = (userId: string): SignalingPeer => ({
  userId,
  username: "peer",
  displayName: "Peer",
});
