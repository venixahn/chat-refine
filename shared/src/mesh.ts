export const AV_MESH_CAP = 6;

export const canAddAvPeer = (currentPeerCount: number): boolean =>
  currentPeerCount < AV_MESH_CAP;
