import { AV_MESH_CAP } from "@chat-refine/shared";

export const callCountLabel = (inCall: boolean, others: number): string => {
  const total = others + (inCall ? 1 : 0);
  if (total === 0) {
    return "";
  }
  return `${total} in call`;
};

export const joinCallLabel = (full: boolean): string =>
  full ? `Call full (${AV_MESH_CAP})` : "Join call";
