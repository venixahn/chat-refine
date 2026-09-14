import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileStore } from "./file-store.ts";

describe("FileStore", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("writes and reads a blob next to the db path", async () => {
    dir = await mkdtemp(join(tmpdir(), "chat-files-"));
    process.env.CHAT_REFINE_DB_PATH = join(dir, "db.json");
    const store = new FileStore();
    await store.put("blob-a", Buffer.from("hello"));
    expect((await store.get("blob-a"))?.toString()).toBe("hello");
    expect(await store.get("missing")).toBeUndefined();
  });
});
