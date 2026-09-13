import { describe, expect, it } from "vitest";
import { AV_MESH_CAP } from "@chat-refine/shared";
import { callCountLabel, joinCallLabel } from "./call-labels.ts";

describe("call stage labels", () => {
  it("counts local plus remote peers", () => {
    expect(callCountLabel(false, 0)).toBe("");
    expect(callCountLabel(true, 0)).toBe("1 in call");
    expect(callCountLabel(false, 2)).toBe("2 in call");
    expect(callCountLabel(true, 2)).toBe("3 in call");
  });

  it("names a full call", () => {
    expect(joinCallLabel(false)).toBe("Join call");
    expect(joinCallLabel(true)).toBe(`Call full (${AV_MESH_CAP})`);
  });
});
