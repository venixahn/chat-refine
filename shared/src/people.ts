export type SearchablePerson = {
  id: string;
  username: string;
  displayName: string;
};

export const hasSubsequence = (haystack: string, needle: string): boolean => {
  if (needle.length === 0) {
    return true;
  }
  let offset = 0;
  const hay = haystack.toLowerCase();
  const query = needle.toLowerCase();
  for (const character of hay) {
    if (character === query[offset]) {
      offset += 1;
    }
    if (offset === query.length) {
      return true;
    }
  }
  return false;
};

export const peopleScore = (query: string, person: SearchablePerson): number => {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return 1;
  }
  const username = person.username.toLowerCase();
  const display = person.displayName.toLowerCase();
  if (username === needle) {
    return 100;
  }
  if (display === needle) {
    return 90;
  }
  if (username.startsWith(needle)) {
    return 80;
  }
  if (display.startsWith(needle)) {
    return 70;
  }
  if (username.includes(needle)) {
    return 60;
  }
  if (display.includes(needle)) {
    return 50;
  }
  return hasSubsequence(username, needle) || hasSubsequence(display, needle)
    ? 25
    : 0;
};

export const rankPeople = <T extends SearchablePerson>(
  query: string,
  people: readonly T[],
): T[] =>
  people
    .map((person) => ({ person, score: peopleScore(query, person) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      const byScore = right.score - left.score;
      return byScore !== 0
        ? byScore
        : left.person.username.localeCompare(right.person.username);
    })
    .map((item) => item.person);
