import { describe, expect, it, vi } from "vitest";
import { bindSrcObject } from "./media-el.ts";

describe("bindSrcObject", () => {
  it("assigns the stream and plays", () => {
    const el = { srcObject: null, play: vi.fn(async () => undefined) };
    const stream = {} as MediaStream;
    bindSrcObject(el as unknown as HTMLMediaElement, stream);
    expect(el.srcObject).toBe(stream);
    expect(el.play).toHaveBeenCalled();
  });

  it("clears the element when the stream is missing", () => {
    const el = { srcObject: {} as MediaStream, play: vi.fn() };
    bindSrcObject(el as unknown as HTMLMediaElement, null);
    expect(el.srcObject).toBeNull();
    expect(el.play).not.toHaveBeenCalled();
  });
});
