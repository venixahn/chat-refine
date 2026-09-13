import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { DEFAULT_ICE_SERVERS } from "@chat-refine/shared";
import { createApp } from "../src/http/create-app.ts";
import { DbService } from "../src/db/db.service.ts";

const ada = {
  username: "ada",
  displayName: "Ada Lovelace",
  password: "sufficient",
};

describe("GET /api/ice", () => {
  let app: INestApplication;
  let dbDir: string;
  let db: DbService;
  let previousIce: string | undefined;

  beforeAll(async () => {
    dbDir = await mkdtemp(join(tmpdir(), "chat-refine-ice-"));
    process.env.CHAT_REFINE_DB_PATH = join(dbDir, "db.json");
    process.env.SESSION_SECRET = "test-secret";
    app = await createApp();
    await app.init();
    db = app.get(DbService);
  });

  afterAll(async () => {
    await app.close();
    await rm(dbDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    previousIce = process.env.ICE_SERVERS;
    delete process.env.ICE_SERVERS;
    await db.update((data) => {
      data.profiles.length = 0;
      data.conversationMembers.length = 0;
      data.messages.length = 0;
      data.readCursors.length = 0;
    });
  });

  afterEach(() => {
    if (previousIce === undefined) {
      delete process.env.ICE_SERVERS;
    } else {
      process.env.ICE_SERVERS = previousIce;
    }
  });

  it("rejects an anonymous request", async () => {
    const response = await request(app.getHttpServer()).get("/api/ice");
    expect(response.status).toBe(401);
  });

  it("returns public Google STUN by default", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/signup").send(ada);
    const response = await agent.get("/api/ice");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ iceServers: DEFAULT_ICE_SERVERS });
  });

  it("returns an explicit empty list for LAN-only", async () => {
    process.env.ICE_SERVERS = "[]";
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/signup").send(ada);
    const response = await agent.get("/api/ice");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ iceServers: [] });
  });

  it("returns configured STUN and TURN servers", async () => {
    process.env.ICE_SERVERS = JSON.stringify([
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:turn.example:3478",
        username: "chat",
        credential: "secret",
      },
    ]);
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/signup").send(ada);
    const response = await agent.get("/api/ice");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:turn.example:3478",
          username: "chat",
          credential: "secret",
        },
      ],
    });
  });
});
