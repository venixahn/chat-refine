import { describe, expect, it } from "vitest";
import { continuesBurst, formatClock, initialsOf } from "./thread-ui.ts";

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
