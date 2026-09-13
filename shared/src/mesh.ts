import { z } from "zod";

/** Call size cap. A/V goes through the Nest SFU, so this is no longer a mesh degree. */
export const AV_MESH_CAP = 16;

export const sfuSubscribers = (
  publisherId: string,
  memberIds: readonly string[],
): string[] => memberIds.filter((id) => id !== publisherId);

export const canAddAvPeer = (currentPeerCount: number): boolean =>
  currentPeerCount < AV_MESH_CAP;

export const callPresenceSchema = z.object({
  userId: z.string().min(1),
  audio: z.boolean(),
  video: z.boolean(),
});

export type CallPresence = z.infer<typeof callPresenceSchema>;

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

export const mediaPeerIds = (
  selfId: string,
  inCall: boolean,
  roster: readonly CallPresence[],
): string[] => {
  if (!inCall) {
    return [];
  }
  return roster
    .filter((item) => item.userId !== selfId)
    .map((item) => item.userId);
};

export const shouldIgnoreOffer = (polite: boolean, glare: boolean): boolean =>
  glare && !polite;
