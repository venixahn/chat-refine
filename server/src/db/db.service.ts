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

const seedRooms = (data: DbSchema): void => {
  data.conversations = seededRooms(data, new Date().toISOString());
};

@Injectable()
export class DbService implements OnModuleInit {
  private db!: Awaited<ReturnType<typeof JSONFilePreset<DbSchema>>>;
  private tail: Promise<unknown> = Promise.resolve();

  async onModuleInit(): Promise<void> {
    const filePath = process.env.CHAT_REFINE_DB_PATH ?? repoDataPath;
    await mkdir(dirname(filePath), { recursive: true });
    this.db = await JSONFilePreset<DbSchema>(filePath, emptyDb());
    await this.update((data) => {
      normalizeDb(data);
      seedRooms(data);
    });
  }

  snapshot(): DbSchema {
    return this.db.data;
  }

  update<A>(fn: (data: DbSchema) => A): Promise<A> {
    const run = this.tail.then(
      async () => {
        await this.db.read();
        normalizeDb(this.db.data);
        const result = fn(this.db.data);
        await this.db.write();
        return result;
      },
      async () => {
        await this.db.read();
        normalizeDb(this.db.data);
        const result = fn(this.db.data);
        await this.db.write();
        return result;
      },
    );
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
