import { describe, expect, it } from "vitest";
import {
  loadHistory,
  persistAll,
  persistMessage,
  type HistoryStore,
} from "./local-history.ts";

const memory = (): HistoryStore => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

describe("local history", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(loadHistory("room-general", memory())).toEqual([]);
  });

  it("persists and replaces an edited body", () => {
    const store = memory();
    const first = {
      clientMessageId: "msg-aaaa-1",
      conversationId: "room-general",
      body: "hello",
      createdAt: "2026-09-12T00:00:01.000Z",
      fromUserId: "ada",
    };
    persistMessage("room-general", first, store);
    const again = persistAll(
      "room-general",
      [{ ...first, body: "changed", editedAt: "2026-09-12T00:00:09.000Z" }],
      store,
    );
    expect(again[0]?.body).toBe("changed");
    expect(loadHistory("room-general", store)[0]?.body).toBe("changed");
  });

  it("ignores corrupt storage", () => {
    const store = memory();
    store.setItem("chat-refine:history:room-general", "{");
    expect(loadHistory("room-general", store)).toEqual([]);
  });
});
