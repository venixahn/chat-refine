import { describe, expect, it } from "vitest";
import { crc32, zipStore } from "./zip-store.ts";

describe("zipStore", () => {
  it("builds a zip with the PK headers", () => {
    const bytes = zipStore([
      { name: "notes/a.txt", data: new TextEncoder().encode("hi") },
    ]);
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe(
      "PK\u0003\u0004",
    );
    expect(bytes.length).toBeGreaterThan(30);
    expect(crc32(new TextEncoder().encode("hi"))).toBeGreaterThan(0);
  });
});
