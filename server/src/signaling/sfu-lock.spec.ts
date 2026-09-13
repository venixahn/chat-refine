import { describe, expect, it } from "vitest";
import { createExclusive } from "./sfu-lock.ts";

describe("createExclusive", () => {
  it("runs queued work in order", async () => {
    const exclusive = createExclusive();
    const order: number[] = [];
    await Promise.all([
      exclusive(async () => {
        await Promise.resolve();
        order.push(1);
      }),
      exclusive(async () => {
        order.push(2);
      }),
    ]);
    expect(order).toEqual([1, 2]);
  });
});
