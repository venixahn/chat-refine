export const AV_MESH_CAP = 6;

export const canAddAvPeer = (currentPeerCount: number): boolean =>
  currentPeerCount < AV_MESH_CAP;

export type CallPresence = {
  userId: string;
  audio: boolean;
  video: boolean;
};

export const applyCallState = (
  roster: readonly CallPresence[],
  userId: string,
  state: { inCall: boolean; audio: boolean; video: boolean },
): CallPresence[] => {
  const rest = roster.filter((item) => item.userId !== userId);
  if (!state.inCall) {
    return rest;
  }
  return [...rest, { userId, audio: state.audio, video: state.video }];
};

export const avPeerCount = (roster: readonly CallPresence[]): number =>
  roster.length;
