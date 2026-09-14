import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Injectable, type OnModuleInit } from "@nestjs/common";
import { JSONFilePreset } from "lowdb/node";
import { emptyDb, normalizeDb, seededRooms, type DbSchema } from "./schema.ts";

const repoDataPath = join(
  fileURLToPath(new URL("../../..", import.meta.url)),
  "data/db.json",
);

const applyDb = (data: DbSchema): void => {
  const next = normalizeDb(data);
  data.profiles = next.profiles;
  data.conversations = seededRooms(next, new Date().toISOString());
  data.conversationMembers = next.conversationMembers;
  data.messages = next.messages;
  data.readCursors = next.readCursors;
};

const writeThrough = async <A>(
  db: Awaited<ReturnType<typeof JSONFilePreset<DbSchema>>>,
  fn: (data: DbSchema) => A,
): Promise<A> => {
  await db.read();
  applyDb(db.data);
  const result = fn(db.data);
  await db.write();
  return result;
};

@Injectable()
export class DbService implements OnModuleInit {
  private db!: Awaited<ReturnType<typeof JSONFilePreset<DbSchema>>>;
  private tail: Promise<unknown> = Promise.resolve();

  async onModuleInit(): Promise<void> {
    const filePath = process.env.CHAT_REFINE_DB_PATH ?? repoDataPath;
    await mkdir(dirname(filePath), { recursive: true });
    this.db = await JSONFilePreset<DbSchema>(filePath, emptyDb());
    await this.update(() => undefined);
  }

  snapshot(): DbSchema {
    return this.db.data;
  }

  update<A>(fn: (data: DbSchema) => A): Promise<A> {
    const run = this.tail.then(
      async () => writeThrough(this.db, fn),
      async () => writeThrough(this.db, fn),
    );
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
