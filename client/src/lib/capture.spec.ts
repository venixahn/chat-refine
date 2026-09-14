import { describe, expect, it, vi } from "vitest";
import { callMediaError, captureLocal } from "./capture.ts";

describe("callMediaError", () => {
  it("asks for HTTPS when getUserMedia is missing", () => {
    vi.stubGlobal("navigator", {});
    expect(callMediaError()).toMatch(/HTTPS/);
    vi.unstubAllGlobals();
  });

  it("explains a permission denial before mentioning HTTPS", () => {
    vi.stubGlobal("window", { isSecureContext: false });
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
