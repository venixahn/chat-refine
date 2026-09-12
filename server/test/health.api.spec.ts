import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../src/http/create-app.ts";

describe("GET /api/health", () => {
  let app: INestApplication;
  let dbDir: string;

  beforeAll(async () => {
    dbDir = await mkdtemp(join(tmpdir(), "chat-refine-health-"));
    process.env.CHAT_REFINE_DB_PATH = join(dbDir, "db.json");
    process.env.SESSION_SECRET = "test-secret";
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await rm(dbDir, { recursive: true, force: true });
  });

  it("returns ok", async () => {
    const response = await request(app.getHttpServer()).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
