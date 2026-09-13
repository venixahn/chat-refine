import { describe, expect, it } from "vitest";
import {
  createGroupSchema,
  dmPairKey,
  openDmSchema,
  peopleQuerySchema,
  postMessageSchema,
} from "./rooms.ts";

describe("dmPairKey", () => {
  it("is stable regardless of argument order", () => {
    expect(dmPairKey("b", "a")).toBe(dmPairKey("a", "b"));
  });

  it("differs for different pairs", () => {
    expect(dmPairKey("a", "b")).not.toBe(dmPairKey("a", "c"));
  });
});

describe("createGroupSchema", () => {
  it("accepts a named group", () => {
    expect(createGroupSchema.safeParse({ name: "standup" }).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(createGroupSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("openDmSchema", () => {
  it("requires a username", () => {
    expect(openDmSchema.safeParse({ username: "ada" }).success).toBe(true);
    expect(openDmSchema.safeParse({ username: "ab" }).success).toBe(false);
  });
});

describe("postMessageSchema", () => {
  it("accepts text or a file", () => {
    expect(
      postMessageSchema.safeParse({
        clientMessageId: "msg-ada-01",
        body: "hello",
      }).success,
    ).toBe(true);
    expect(
      postMessageSchema.safeParse({
        clientMessageId: "msg-ada-02",
        body: "",
        attachment: {
          name: "dot.png",
          mime: "image/png",
          data: "a".repeat(16),
        },
      }).success,
    ).toBe(true);
    expect(
      postMessageSchema.safeParse({
        clientMessageId: "msg-ada-03",
        body: "   ",
      }).success,
    ).toBe(false);
  });
});

describe("peopleQuerySchema", () => {
  it("accepts an optional query", () => {
    expect(peopleQuerySchema.safeParse({}).success).toBe(true);
    expect(peopleQuerySchema.safeParse({ q: "ada" }).success).toBe(true);
    expect(peopleQuerySchema.safeParse({ q: "x".repeat(33) }).success).toBe(
      false,
    );
  });
});

