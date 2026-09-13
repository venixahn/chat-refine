import { describe, expect, it } from "vitest";
import { AV_MESH_CAP } from "@chat-refine/shared";
import { CallRosterService } from "./call-roster.service.ts";

const join = (audio = true, video = false) => ({
  inCall: true,
  audio,
  video,
});

const leave = { inCall: false, audio: false, video: false };

describe("CallRosterService", () => {
  it("upserts a peer and drops them on leave", () => {
    const roster = new CallRosterService();
    const joined = roster.apply("room-general", "ada", join());
    expect(joined).toEqual({
      ok: true,
      changed: true,
      roster: [{ userId: "ada", audio: true, video: false }],
    });
    expect(roster.snapshot("room-general")).toHaveLength(1);
    const muted = roster.apply("room-general", "ada", join(false, true));
    expect(muted.ok && muted.roster[0]).toEqual({
      userId: "ada",
      audio: false,
      video: true,
    });
    expect(roster.apply("room-general", "ada", leave)).toMatchObject({
      ok: true,
      changed: true,
      roster: [],
    });
    expect(roster.snapshot("room-general")).toEqual([]);
  });

  it("refuses a peer at the mesh cap", () => {
    const roster = new CallRosterService();
    for (let index = 0; index < AV_MESH_CAP; index += 1) {
      const result = roster.apply("room-general", `user-${index}`, join());
      expect(result.ok).toBe(true);
    }
    expect(roster.apply("room-general", "late", join())).toEqual({
      ok: false,
      reason: "call-full",
    });
    expect(roster.snapshot("room-general")).toHaveLength(AV_MESH_CAP);
    expect(roster.apply("room-general", "user-0", join(true, true)).ok).toBe(
      true,
    );
  });

  it("drops a user from every conversation they were in", () => {
    const roster = new CallRosterService();
    roster.apply("room-general", "ada", join());
    roster.apply("room-random", "ada", join());
    roster.apply("room-general", "bob", join());
    const updates = roster.dropUser("ada", ["room-general", "room-random"]);
    expect(updates).toEqual([
      {
        conversationId: "room-general",
        roster: [{ userId: "bob", audio: true, video: false }],
      },
      { conversationId: "room-random", roster: [] },
    ]);
  });
});
