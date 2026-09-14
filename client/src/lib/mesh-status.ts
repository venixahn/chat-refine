export const ICE_STALL_MS = 8_000;

export const meshStatus = (open: number, knownPeers: number): string => {
  if (open > 0) {
    return `Connected · ${open} peer${open === 1 ? "" : "s"}`;
  }
  return knownPeers === 0 ? "Waiting for peers" : "Connecting peers…";
};

export const iceStalled = (
  open: number,
  links: readonly { ice: string; startedAt: number }[],
  now = Date.now(),
): boolean => {
  if (open > 0) {
    return false;
  }
  return links.some((link) => {
    if (link.ice === "failed" || link.ice === "disconnected") {
      return true;
    }
    return now - link.startedAt >= ICE_STALL_MS;
  });
};

export const stallHint = (relay: boolean): string =>
  relay
    ? "Still trying from this network."
    : "Still trying from this network. Ask the host to add a relay.";
