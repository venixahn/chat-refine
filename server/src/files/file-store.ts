import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Injectable } from "@nestjs/common";

const defaultRoot = join(
  fileURLToPath(new URL("../../..", import.meta.url)),
  "data/files",
);

@Injectable()
export class FileStore {
  root(): string {
    const dbPath = process.env.CHAT_REFINE_DB_PATH;
    return dbPath ? join(dirname(dbPath), "files") : defaultRoot;
  }

  async put(id: string, bytes: Buffer): Promise<void> {
    const path = join(this.root(), id);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async get(id: string): Promise<Buffer | undefined> {
    try {
      return await readFile(join(this.root(), id));
    } catch {
      return undefined;
    }
  }
}
