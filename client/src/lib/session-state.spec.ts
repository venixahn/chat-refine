import { describe, expect, it } from "vitest";
import { liveTypers, rememberPeers, remoteTiles } from "./session-state.ts";

const ada = {
  userId: "ada",
  username: "ada",
  displayName: "Ada",
};

describe("session-state", () => {
  it("drops expired typers and names live ones", () => {
    const typing = new Map<string, number>([
      ["ada", 10],
      ["bob", 1],
    ]);
    const roster = new Map([["ada", ada]]);
    const result = liveTypers(typing, roster, 5);
    expect(result.names).toEqual(["Ada"]);
    expect([...result.next.keys()]).toEqual(["ada"]);
  });

  it("indexes peers and remote tiles", () => {
    const roster = rememberPeers(new Map(), [ada]);
    expect(roster.get("ada")?.displayName).toBe("Ada");
    expect(
      remoteTiles(new Map([["ada", null]])),
    ).toEqual([{ userId: "ada", stream: null }]);
  });
});
