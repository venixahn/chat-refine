import type { SignalingPeer } from "@chat-refine/shared";

export const liveTypers = (
  typingUntil: ReadonlyMap<string, number>,
  roster: ReadonlyMap<string, SignalingPeer>,
  now: number,
): { next: Map<string, number>; names: string[] } => {
  const live = [...typingUntil].filter(([, expires]) => expires > now);
  return {
    next: new Map(live),
    names: live.flatMap(([userId]) => {
      const peer = roster.get(userId);
      return peer ? [peer.displayName] : [];
    }),
  };
};

export const rememberPeers = (
  roster: Map<string, SignalingPeer>,
  peers: readonly SignalingPeer[],
): Map<string, SignalingPeer> =>
  peers.reduce((next, peer) => next.set(peer.userId, peer), roster);

export const remoteTiles = (
  remoteByUser: ReadonlyMap<string, MediaStream | null>,
): { userId: string; stream: MediaStream | null }[] =>
  [...remoteByUser.entries()].map(([userId, stream]) => ({ userId, stream }));
