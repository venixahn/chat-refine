export const isAvSender = (sender: RTCRtpSender): boolean =>
  sender.track?.kind === "audio" || sender.track?.kind === "video";

export const attachToPc = (pc: RTCPeerConnection, stream: MediaStream): void => {
  for (const track of stream.getTracks()) {
    const sender = pc.getSenders().find((item) => item.track?.kind === track.kind);
    if (sender) {
      void sender.replaceTrack(track);
    } else {
      pc.addTrack(track, stream);
    }
  }
};

export const detachAvFromPc = (pc: RTCPeerConnection): void => {
  for (const sender of pc.getSenders()) {
    if (isAvSender(sender)) {
      pc.removeTrack(sender);
    }
  }
};

export const replaceKindOnPc = async (
  pc: RTCPeerConnection,
  kind: "audio" | "video",
  track: MediaStreamTrack | null,
  stream: MediaStream | null,
): Promise<void> => {
  const sender = pc.getSenders().find((item) => item.track?.kind === kind);
  if (sender) {
    await sender.replaceTrack(track);
    return;
  }
  if (track && stream) {
    pc.addTrack(track, stream);
  }
};

export const mergeRemoteTrack = (
  existing: MediaStream | undefined,
  event: RTCTrackEvent,
): MediaStream => {
  const stream = existing ?? event.streams[0];
  if (!stream) {
    return new MediaStream([event.track]);
  }
  if (!stream.getTracks().includes(event.track)) {
    stream.addTrack(event.track);
  }
  return stream;
};

export const liveRemoteStream = (stream: MediaStream): MediaStream | null =>
  stream.getTracks().some((track) => track.readyState === "live") ? stream : null;
