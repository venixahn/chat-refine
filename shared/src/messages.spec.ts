import { describe, expect, it } from "vitest";
import { upsertMessage, type ChatMessage } from "./messages.ts";

const line = (id: string, createdAt: string, body = "hi"): ChatMessage => ({
  clientMessageId: id,
  conversationId: "room-general",
  body,
  createdAt,
  fromUserId: "user-1",
});

describe("upsertMessage", () => {
  it("appends and sorts by time then id", () => {
    const first = line("msg-bbbb", "2026-09-12T00:00:02.000Z");
    const second = line("msg-aaaa", "2026-09-12T00:00:01.000Z");
    expect(upsertMessage([first], second).map((item) => item.clientMessageId)).toEqual([
      "msg-aaaa",
      "msg-bbbb",
    ]);
  });

  it("ignores a duplicate clientMessageId", () => {
    const existing = line("msg-aaaa", "2026-09-12T00:00:01.000Z", "first");
    const dup = line("msg-aaaa", "2026-09-12T00:00:09.000Z", "again");
    expect(upsertMessage([existing], dup)).toEqual([existing]);
  });

  it("orders equal timestamps by clientMessageId", () => {
    const laterId = line("msg-bbbb", "2026-09-12T00:00:01.000Z");
    const earlierId = line("msg-aaaa", "2026-09-12T00:00:01.000Z");
    expect(
      upsertMessage([laterId], earlierId).map((item) => item.clientMessageId),
    ).toEqual(["msg-aaaa", "msg-bbbb"]);
    expect(upsertMessage([earlierId], laterId).map((item) => item.clientMessageId)).toEqual(
      ["msg-aaaa", "msg-bbbb"],
    );
  });
});
