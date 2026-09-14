import { describe, expect, it } from "vitest";
import { packAttachments, zipFolderFiles } from "./file.ts";

const fakeFile = (name: string, body: string, relative = ""): File => {
  const file = new File([body], name, { type: "text/plain" });
  Object.defineProperty(file, "webkitRelativePath", { value: relative });
  return file;
};

describe("packAttachments", () => {
  it("returns a lone file unchanged", async () => {
    const note = fakeFile("note.txt", "hi");
    await expect(packAttachments([note])).resolves.toBe(note);
  });

  it("zips a folder even when webkitRelativePath is missing", async () => {
    const packed = await packAttachments([
      fakeFile("a.txt", "a"),
      fakeFile("b.txt", "b"),
    ]);
    expect(packed?.name).toBe("a.txt.zip");
    expect(packed?.type).toBe("application/zip");
    expect((packed?.size ?? 0) > 0).toBe(true);
  });

  it("zips nested folder paths under the root name", async () => {
    const packed = await zipFolderFiles([
      fakeFile("readme.txt", "docs", "notes/readme.txt"),
      fakeFile("todo.txt", "x", "notes/todo.txt"),
    ]);
    expect(packed.name).toBe("notes.zip");
  });

  it("treats a single nested file as a folder", async () => {
    const packed = await packAttachments([
      fakeFile("readme.txt", "docs", "notes\\readme.txt"),
    ]);
    expect(packed?.name).toBe("notes.zip");
  });
});
