import { Injectable, type OnModuleInit } from "@nestjs/common";
import { JSONFilePreset } from "lowdb/node";
import { emptyDb, type DbSchema } from "./schema.ts";

const seedRooms = (data: DbSchema): void => {
  if (data.conversations.length > 0) {
    return;
  }
  const now = new Date().toISOString();
  data.conversations.push(
    {
      id: "room-general",
      kind: "group",
      slug: "general",
      name: "general",
      createdAt: now,
    },
    {
      id: "room-random",
      kind: "group",
      slug: "random",
      name: "random",
      createdAt: now,
    },
  );
};

@Injectable()
export class DbService implements OnModuleInit {
  private db!: Awaited<ReturnType<typeof JSONFilePreset<DbSchema>>>;
  private tail: Promise<unknown> = Promise.resolve();

  async onModuleInit(): Promise<void> {
    const filePath = process.env.CHAT_REFINE_DB_PATH ?? "data/db.json";
    this.db = await JSONFilePreset<DbSchema>(filePath, emptyDb());
    await this.update((data) => {
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
        const result = fn(this.db.data);
        await this.db.write();
        return result;
      },
      async () => {
        await this.db.read();
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
