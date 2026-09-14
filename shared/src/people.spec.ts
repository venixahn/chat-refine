import { describe, expect, it } from "vitest";
import { hasSubsequence, peopleScore, rankPeople } from "./people.ts";

const ada = { id: "1", username: "ada", displayName: "Ada Lovelace" };
const bob = { id: "2", username: "bob", displayName: "Bob Barker" };
const al = { id: "3", username: "alovelace", displayName: "A. Lovelace" };

describe("hasSubsequence", () => {
  it("matches letters in order", () => {
    expect(hasSubsequence("Ada Lovelace", "al")).toBe(true);
    expect(hasSubsequence("Ada Lovelace", "zl")).toBe(false);
  });
});

describe("rankPeople", () => {
  it("ranks exact username first, then prefix, then subsequence", () => {
    const ranked = rankPeople("ada", [bob, al, ada]);
    expect(ranked.map((item) => item.username)).toEqual(["ada"]);
    expect(rankPeople("alo", [bob, al, ada])[0]?.username).toBe("alovelace");
  });

  it("matches a display-name fragment like Telegram", () => {
    expect(peopleScore("love", ada)).toBeGreaterThan(0);
    expect(rankPeople("bark", [ada, bob])[0]?.username).toBe("bob");
  });
});
