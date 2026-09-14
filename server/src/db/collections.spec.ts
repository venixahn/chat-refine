import { describe, expect, it } from "vitest";
import { append, appendAll, replaceWhere, upsertWhere } from "./collections.ts";

describe("collections", () => {
  it("appends without mutating the source", () => {
    const source = [1, 2];
    expect(append(source, 3)).toEqual([1, 2, 3]);
    expect(appendAll(source, [3, 4])).toEqual([1, 2, 3, 4]);
    expect(source).toEqual([1, 2]);
  });

  it("replaces matching items and upserts when missing", () => {
    const source = [
      { id: "a", n: 1 },
      { id: "b", n: 2 },
    ];
    expect(
      replaceWhere(source, (item) => item.id === "b", (item) => ({
        ...item,
        n: 9,
      })),
    ).toEqual([
      { id: "a", n: 1 },
      { id: "b", n: 9 },
    ]);
    expect(
      upsertWhere(
        source,
        (item) => item.id === "c",
        (item) => item,
        () => ({ id: "c", n: 3 }),
      ),
    ).toEqual([
      { id: "a", n: 1 },
      { id: "b", n: 2 },
      { id: "c", n: 3 },
    ]);
  });
});
