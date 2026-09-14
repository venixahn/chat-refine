export const append = <T>(items: readonly T[], item: T): T[] => [
  ...items,
  item,
];

export const appendAll = <T>(
  items: readonly T[],
  extra: readonly T[],
): T[] => [...items, ...extra];

export const replaceWhere = <T>(
  items: readonly T[],
  match: (item: T) => boolean,
  update: (item: T) => T,
): T[] => items.map((item) => (match(item) ? update(item) : item));

export const upsertWhere = <T>(
  items: readonly T[],
  match: (item: T) => boolean,
  update: (item: T) => T,
  create: () => T,
): T[] =>
  items.some(match)
    ? replaceWhere(items, match, update)
    : append(items, create());
