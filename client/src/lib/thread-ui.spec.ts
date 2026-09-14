import { describe, expect, it } from "vitest";
import {
  continuesBurst,
  firstUnreadId,
  formatClock,
  initialsOf,
  matchesQuery,
  presenceOf,
} from "./thread-ui.ts";

describe("formatClock", () => {
  it("shows a clock for a message from the last minute", () => {
    const now = Date.now();
    const label = formatClock(new Date(now - 60_000).toISOString(), now);
    expect(label.length).toBeGreaterThan(0);
    expect(label).not.toMatch(/[A-Z][a-z]{2} \d/);
  });

  it("shows a date for a message from two days ago", () => {
    const now = Date.now();
    const older = new Date(now - 48 * 60 * 60 * 1000).toISOString();
    expect(formatClock(older, now)).toMatch(/[A-Z][a-z]{2} \d/);
  });
});

describe("continuesBurst", () => {
  const base = {
    fromUserId: "ada",
    createdAt: "2026-09-14T20:00:00.000Z",
  };

  it("groups the same author within five minutes", () => {
    expect(
      continuesBurst(base, {
        fromUserId: "ada",
        createdAt: "2026-09-14T20:04:00.000Z",
      }),
    ).toBe(true);
  });

  it("starts a new burst for another author or a long gap", () => {
    expect(
      continuesBurst(base, {
        fromUserId: "bob",
        createdAt: "2026-09-14T20:01:00.000Z",
      }),
    ).toBe(false);
    expect(
      continuesBurst(base, {
        fromUserId: "ada",
        createdAt: "2026-09-14T20:06:00.000Z",
      }),
    ).toBe(false);
  });
});

describe("initialsOf", () => {
  it("uses the first letter", () => {
    expect(initialsOf(" ada")).toBe("A");
    expect(initialsOf("")).toBe("?");
  });
});

describe("firstUnreadId", () => {
  it("skips self and finds the first later line", () => {
    expect(
      firstUnreadId(
        [
          {
            clientMessageId: "msg-self",
            fromUserId: "ada",
            createdAt: "2026-09-14T20:01:00.000Z",
          },
          {
            clientMessageId: "msg-bob",
            fromUserId: "bob",
            createdAt: "2026-09-14T20:02:00.000Z",
          },
        ],
        "ada",
        "2026-09-14T20:00:00.000Z",
      ),
    ).toBe("msg-bob");
  });
});

describe("presenceOf", () => {
  const ada = { id: "ada", displayName: "Ada", avatarUrl: "/ada.png" };
  const bob = { id: "bob", displayName: "Bob", avatarUrl: null };
  const cal = { id: "cal", displayName: "Cal" };

  it("marks self and signaling peers as here, and sorts here first", () => {
    expect(
      presenceOf(
        [bob, cal, ada],
        [{ userId: "bob", displayName: "Bob" }],
        ada,
      ),
    ).toEqual([
      { id: "ada", name: "Ada", avatarUrl: "/ada.png", here: true },
      { id: "bob", name: "Bob", avatarUrl: null, here: true },
      { id: "cal", name: "Cal", avatarUrl: null, here: false },
    ]);
  });

  it("adds a signaling peer who is not in the member snapshot yet", () => {
    expect(
      presenceOf(
        [ada],
        [{ userId: "bob", displayName: "Bob" }],
        ada,
      ),
    ).toEqual([
      { id: "ada", name: "Ada", avatarUrl: "/ada.png", here: true },
      { id: "bob", name: "Bob", avatarUrl: null, here: true },
    ]);
  });
});

describe("matchesQuery", () => {
  it("matches body text and skips deleted lines", () => {
    expect(matchesQuery("hi", { body: "Hi there" })).toBe(true);
    expect(matchesQuery("hi", { body: "Hi there", deletedAt: "now" })).toBe(
      false,
    );
  });
});
