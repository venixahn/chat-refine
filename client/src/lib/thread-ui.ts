export const BURST_GAP_MS = 5 * 60 * 1000;

export type BurstLine = {
  fromUserId: string;
  createdAt: string;
};

export const formatClock = (iso: string, now = Date.now()): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const sameDay = date.toDateString() === new Date(now).toDateString();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const continuesBurst = (
  previous: BurstLine | undefined,
  current: BurstLine,
): boolean => {
  if (!previous || previous.fromUserId !== current.fromUserId) {
    return false;
  }
  const gap = Math.abs(
    Date.parse(current.createdAt) - Date.parse(previous.createdAt),
  );
  return Number.isFinite(gap) && gap < BURST_GAP_MS;
};

export const initialsOf = (name: string): string => {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : "?";
};
