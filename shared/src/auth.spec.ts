import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "./auth.ts";

describe("signupSchema", () => {
  it("accepts a valid payload", () => {
    const parsed = signupSchema.safeParse({
      username: "ada",
      displayName: "Ada Lovelace",
      password: "sufficient",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a short username", () => {
    const parsed = signupSchema.safeParse({
      username: "ab",
      displayName: "Ada",
      password: "sufficient",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a short password", () => {
    const parsed = signupSchema.safeParse({
      username: "ada",
      displayName: "Ada",
      password: "short",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires username and password", () => {
    expect(loginSchema.safeParse({ username: "ada" }).success).toBe(false);
    expect(
      loginSchema.safeParse({ username: "ada", password: "sufficient" }).success,
    ).toBe(true);
  });
});
