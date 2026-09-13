import type { IceServer } from "@chat-refine/shared";
import {
  RTCPeerConnection,
  type MediaStreamTrack,
  type RTCRtpTransceiver,
} from "werift";

export type SfuEndpoint = {
  pc: RTCPeerConnection;
  inbound: MediaStreamTrack[];
  timers: ReturnType<typeof setInterval>[];
};

export const createSfuPeer = (
  iceServers: IceServer[],
  hooks: {
    onIce: (candidate: string) => void;
    onTrack: (track: MediaStreamTrack) => void;
  },
): RTCPeerConnection => {
  const pc = new RTCPeerConnection({
    iceServers: iceServers.map((server) => ({
      urls: server.urls,
      username: server.username,
      credential: server.credential,
    })),
  });
  pc.onIceCandidate.subscribe((candidate) => {
    if (!candidate) {
      return;
    }
    hooks.onIce(JSON.stringify(candidate.toJSON()));
  });
  pc.onTrack.subscribe((track) => {
    hooks.onTrack(track);
  });
  return pc;
};

export const armPli = (
  pc: RTCPeerConnection,
  track: MediaStreamTrack,
  timers: ReturnType<typeof setInterval>[],
): void => {
  if (track.kind !== "video") {
    return;
  }
  const timer = setInterval(() => {
    const ssrc = track.ssrc;
    const transceiver = videoReceiver(pc);
    if (ssrc && transceiver) {
      void transceiver.receiver.sendRtcpPLI(ssrc);
    }
  }, 2000);
  timers.push(timer);
};

export const midOfTrack = (
  pc: RTCPeerConnection,
  track: MediaStreamTrack,
): string | undefined =>
  pc.getTransceivers().find((item) => item.sender.track === track)?.mid ??
  undefined;

export const hasForwarded = (
  pc: RTCPeerConnection,
  track: MediaStreamTrack,
): boolean => pc.getSenders().some((sender) => sender.track === track);

export const dropForwarded = (
  pc: RTCPeerConnection,
  tracks: readonly MediaStreamTrack[],
): void => {
  for (const sender of pc.getSenders()) {
    if (sender.track && tracks.includes(sender.track)) {
      pc.removeTrack(sender);
    }
  }
};

export const closeEndpoint = async (endpoint: SfuEndpoint): Promise<void> => {
  for (const timer of endpoint.timers) {
    clearInterval(timer);
  }
  endpoint.timers.length = 0;
  await endpoint.pc.close();
};

const videoReceiver = (pc: RTCPeerConnection): RTCRtpTransceiver | undefined =>
  pc.getTransceivers().find((item) => item.kind === "video");
