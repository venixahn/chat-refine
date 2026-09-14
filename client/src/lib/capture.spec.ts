import { describe, expect, it, vi } from "vitest";
import { callMediaError, captureLocal } from "./capture.ts";

describe("callMediaError", () => {
  it("asks for localhost or HTTPS off a secure context", () => {
    vi.stubGlobal("window", { isSecureContext: false });
    expect(callMediaError()).toMatch(/127\.0\.0\.1 or HTTPS/);
    vi.unstubAllGlobals();
  });

  it("explains a permission denial", () => {
    vi.stubGlobal("window", { isSecureContext: true });
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn() },
    });
    expect(callMediaError(new DOMException("denied", "NotAllowedError"))).toMatch(
      /Allow camera/,
    );
    vi.unstubAllGlobals();
  });
});

describe("captureLocal", () => {
  it("falls back to audio when camera fails", async () => {
    const audio = { id: "a" } as unknown as MediaStream;
    const gum = vi
      .fn()
      .mockRejectedValueOnce(new Error("no camera"))
      .mockResolvedValueOnce(audio);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: gum } });
    await expect(captureLocal()).resolves.toBe(audio);
    expect(gum).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});
