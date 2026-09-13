import { shouldIgnoreOffer, type SignalingFrame } from "@chat-refine/shared";
import {
  attachToPc,
  liveRemoteStream,
  mergeRemoteTrack,
  replaceKindOnPc,
} from "./mesh-media.ts";

export type SfuLink = {
  attach: (stream: MediaStream) => void;
  replaceKind: (
    kind: "audio" | "video",
    track: MediaStreamTrack | null,
  ) => Promise<void>;
  handleOffer: (sdp: string) => Promise<void>;
  handleAnswer: (sdp: string) => Promise<void>;
  handleIce: (candidate: string) => Promise<void>;
  handleRoute: (fromUserId: string, mid: string) => void;
  close: () => void;
};

const parseCandidate = (candidate: string): RTCIceCandidateInit | null => {
  try {
    return JSON.parse(candidate) as RTCIceCandidateInit;
  } catch {
    return null;
  }
};

export const createSfuLink = (input: {
  conversationId: string;
  iceServers: RTCIceServer[];
  send: (frame: SignalingFrame) => void;
  onRemote: (userId: string, stream: MediaStream | null) => void;
}): SfuLink => {
  const midToUser = new Map<string, string>();
  const pendingTracks = new Map<string, RTCTrackEvent>();
  const streams = new Map<string, MediaStream>();
  const pendingIce: string[] = [];
  let pc: RTCPeerConnection | null = null;
  let local: MediaStream | null = null;
  let makingOffer = false;

  const sendIce = (candidate: RTCIceCandidate) => {
    input.send({
      type: "sfu-ice",
      conversationId: input.conversationId,
      candidate: JSON.stringify(candidate.toJSON()),
    });
  };

  const publish = (userId: string, event: RTCTrackEvent) => {
    const stream = mergeRemoteTrack(streams.get(userId), event);
    streams.set(userId, stream);
    input.onRemote(userId, liveRemoteStream(stream));
  };

  const routeTrack = (event: RTCTrackEvent) => {
    const mid = event.transceiver.mid;
    if (!mid) {
      return;
    }
    const userId = midToUser.get(mid);
    if (!userId) {
      pendingTracks.set(mid, event);
      return;
    }
    publish(userId, event);
  };

  const createOffer = async () => {
    if (!pc || pc.signalingState !== "stable") {
      return;
    }
    makingOffer = true;
    try {
      const offer = await pc.createOffer();
      if (pc.signalingState !== "stable") {
        return;
      }
      await pc.setLocalDescription(offer);
      if (offer.sdp) {
        input.send({
          type: "sfu-offer",
          conversationId: input.conversationId,
          sdp: offer.sdp,
        });
      }
    } finally {
      makingOffer = false;
    }
  };

  const flushIce = async () => {
    if (!pc?.remoteDescription) {
      return;
    }
    const queued = pendingIce.splice(0);
    for (const candidate of queued) {
      const parsed = parseCandidate(candidate);
      if (parsed) {
        await pc.addIceCandidate(parsed);
      }
    }
  };

  const wire = (connection: RTCPeerConnection) => {
    connection.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        sendIce(event.candidate);
      }
    });
    connection.addEventListener("track", (event) => {
      routeTrack(event);
    });
    connection.addEventListener("negotiationneeded", () => {
      void createOffer();
    });
  };

  const ensure = (): RTCPeerConnection => {
    if (pc) {
      return pc;
    }
    pc = new RTCPeerConnection({ iceServers: input.iceServers });
    wire(pc);
    return pc;
  };

  return {
    attach: (stream) => {
      local = stream;
      attachToPc(ensure(), stream);
    },
    replaceKind: async (kind, track) => {
      if (!pc) {
        return;
      }
      await replaceKindOnPc(pc, kind, track, local);
    },
    handleOffer: async (sdp) => {
      const connection = ensure();
      const glare = makingOffer || connection.signalingState !== "stable";
      if (shouldIgnoreOffer(true, glare)) {
        return;
      }
      if (glare) {
        await connection.setLocalDescription({ type: "rollback" });
      }
      await connection.setRemoteDescription({ type: "offer", sdp });
      await flushIce();
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      if (answer.sdp) {
        input.send({
          type: "sfu-answer",
          conversationId: input.conversationId,
          sdp: answer.sdp,
        });
      }
    },
    handleAnswer: async (sdp) => {
      if (!pc || pc.signalingState !== "have-local-offer") {
        return;
      }
      await pc.setRemoteDescription({ type: "answer", sdp });
      await flushIce();
    },
    handleIce: async (candidate) => {
      if (!pc?.remoteDescription) {
        pendingIce.push(candidate);
        return;
      }
      const parsed = parseCandidate(candidate);
      if (parsed) {
        await pc.addIceCandidate(parsed);
      }
    },
    handleRoute: (fromUserId, mid) => {
      midToUser.set(mid, fromUserId);
      const pending = pendingTracks.get(mid);
      if (pending) {
        pendingTracks.delete(mid);
        publish(fromUserId, pending);
      }
    },
    close: () => {
      for (const userId of streams.keys()) {
        input.onRemote(userId, null);
      }
      streams.clear();
      midToUser.clear();
      pendingTracks.clear();
      pendingIce.length = 0;
      pc?.close();
      pc = null;
      local = null;
    },
  };
};
