export const meshStatus = (open: number, knownPeers: number): string => {
  if (open > 0) {
    return `Connected · ${open} peer${open === 1 ? "" : "s"}`;
  }
  return knownPeers === 0 ? "Waiting for peers" : "Connecting peers…";
};
