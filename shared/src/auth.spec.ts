import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema, updateProfileSchema } from "./auth.ts";

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

describe("updateProfileSchema", () => {
  it("requires a display name or avatar", () => {
    expect(
      updateProfileSchema.safeParse({ displayName: "Ada Prime" }).success,
    ).toBe(true);
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
    expect(
      updateProfileSchema.safeParse({ avatarUrl: "https://example.com/a.png" })
        .success,
    ).toBe(false);
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
