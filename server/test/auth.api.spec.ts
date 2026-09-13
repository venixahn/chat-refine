import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../src/http/create-app.ts";
import { DbService } from "../src/db/db.service.ts";

const validSignup = {
  username: "ada",
  displayName: "Ada Lovelace",
  password: "sufficient",
};

describe("auth API", () => {
  let app: INestApplication;
  let dbDir: string;
  let db: DbService;

  beforeAll(async () => {
    dbDir = await mkdtemp(join(tmpdir(), "chat-refine-"));
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
    await db.update((data) => {
      data.profiles.length = 0;
      data.conversationMembers.length = 0;
      data.messages.length = 0;
      data.readCursors.length = 0;
    });
  });

  it("rejects an invalid signup payload", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/auth/signup")
      .send({ username: "ab", displayName: "Ada", password: "short" });
    expect(response.status).toBe(400);
  });

  it("signs up and returns the public profile", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/auth/signup")
      .send(validSignup);
    expect(response.status).toBe(201);
    expect(response.body.username).toBe("ada");
    expect(response.body.displayName).toBe("Ada Lovelace");
    expect(response.body.passwordHash).toBeUndefined();
    expect(response.headers["set-cookie"]).toBeDefined();
  });

  it("rejects a duplicate username", async () => {
    await request(app.getHttpServer()).post("/api/auth/signup").send(validSignup);
    const response = await request(app.getHttpServer())
      .post("/api/auth/signup")
      .send(validSignup);
    expect(response.status).toBe(409);
  });

  it("rejects a bad login", async () => {
    await request(app.getHttpServer()).post("/api/auth/signup").send(validSignup);
    const response = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ username: "ada", password: "wrong-password" });
    expect(response.status).toBe(401);
  });

  it("logs in, reads me, and logs out", async () => {
    const agent = request.agent(app.getHttpServer());
    const signup = await agent.post("/api/auth/signup").send(validSignup);
    expect(signup.status).toBe(201);
    const afterSignup = await agent.get("/api/auth/me");
    expect(afterSignup.status).toBe(200);

    await agent.post("/api/auth/logout").send();

    const denied = await agent.get("/api/auth/me");
    expect(denied.status).toBe(401);

    const login = await agent
      .post("/api/auth/login")
      .send({ username: "ada", password: "sufficient" });
    expect(login.status).toBe(200);

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.username).toBe("ada");

    await agent.post("/api/auth/logout").send();
    const after = await agent.get("/api/auth/me");
    expect(after.status).toBe(401);
  });

  it("updates the display name", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/signup").send(validSignup);
    const updated = await agent
      .patch("/api/auth/me")
      .send({ displayName: "Ada Prime" });
    expect(updated.status).toBe(200);
    expect(updated.body.displayName).toBe("Ada Prime");
    const me = await agent.get("/api/auth/me");
    expect(me.body.displayName).toBe("Ada Prime");
  });

  it("rejects an empty profile patch", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/signup").send(validSignup);
    const response = await agent.patch("/api/auth/me").send({});
    expect(response.status).toBe(400);
  });
});

