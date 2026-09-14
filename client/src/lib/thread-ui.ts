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

export const firstUnreadId = (
  messages: readonly { clientMessageId: string; fromUserId: string; createdAt: string; deletedAt?: string }[],
  selfId: string,
  since: string,
): string | undefined =>
  messages.find(
    (item) =>
      item.fromUserId !== selfId &&
      !item.deletedAt &&
      item.createdAt > since,
  )?.clientMessageId;

export type PresencePerson = {
  id: string;
  name: string;
  avatarUrl: string | null;
  here: boolean;
};

const upsertPerson = (
  rows: Map<string, PresencePerson>,
  id: string,
  name: string,
  avatarUrl: string | null,
  here: boolean,
): void => {
  const existing = rows.get(id);
  if (!existing) {
    rows.set(id, { id, name, avatarUrl, here });
    return;
  }
  rows.set(id, {
    id,
    name: existing.name || name,
    avatarUrl: existing.avatarUrl ?? avatarUrl,
    here: existing.here || here,
  });
};

export const presenceOf = (
  members: readonly {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  }[],
  present: readonly { userId: string; displayName: string }[],
  self?: { id: string; displayName: string; avatarUrl?: string | null },
): PresencePerson[] => {
  const rows = new Map<string, PresencePerson>();
  const online = new Set(present.map((peer) => peer.userId));
  if (self) {
    online.add(self.id);
    upsertPerson(
      rows,
      self.id,
      self.displayName,
      self.avatarUrl ?? null,
      true,
    );
  }
  for (const member of members) {
    upsertPerson(
      rows,
      member.id,
      member.displayName,
      member.avatarUrl ?? null,
      online.has(member.id),
    );
  }
  for (const peer of present) {
    upsertPerson(rows, peer.userId, peer.displayName, null, true);
  }
  return [...rows.values()].sort(
    (left, right) =>
      Number(right.here) - Number(left.here) ||
      left.name.localeCompare(right.name),
  );
};

export const matchesQuery = (
  query: string,
  message: { body: string; deletedAt?: string },
): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle || message.deletedAt) {
    return false;
  }
  return message.body.toLowerCase().includes(needle);
};
