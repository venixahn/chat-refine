import { describe, expect, it } from "vitest";
import {
  createGroupSchema,
  dmPairKey,
  openDmSchema,
  peopleQuerySchema,
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

describe("peopleQuerySchema", () => {
  it("accepts an optional query", () => {
    expect(peopleQuerySchema.safeParse({}).success).toBe(true);
    expect(peopleQuerySchema.safeParse({ q: "ada" }).success).toBe(true);
    expect(peopleQuerySchema.safeParse({ q: "x".repeat(33) }).success).toBe(
      false,
    );
  });
});

