import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../src/http/create-app.ts";
import { DbService } from "../src/db/db.service.ts";

const ada = {
  username: "ada",
  displayName: "Ada Lovelace",
  password: "sufficient",
};

const bob = {
  username: "bob",
  displayName: "Bob Barker",
  password: "sufficient",
};

const resetDirectory = async (db: DbService) => {
  await db.update((data) => {
    data.profiles.length = 0;
    data.conversationMembers.length = 0;
    data.messages.length = 0;
    data.readCursors.length = 0;
    data.conversations.splice(
      0,
      data.conversations.length,
      {
        id: "room-general",
        kind: "group",
        slug: "general",
        name: "general",
        createdAt: "2026-09-12T00:00:00.000Z",
      },
      {
        id: "room-random",
        kind: "group",
        slug: "random",
        name: "random",
        createdAt: "2026-09-12T00:00:00.000Z",
      },
    );
  });
};

describe("rooms API", () => {
  let app: INestApplication;
  let dbDir: string;
  let db: DbService;

  beforeAll(async () => {
    dbDir = await mkdtemp(join(tmpdir(), "chat-refine-rooms-"));
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
    await resetDirectory(db);
  });

  it("rejects an anonymous room list", async () => {
    const response = await request(app.getHttpServer()).get("/api/rooms");
    expect(response.status).toBe(401);
  });

  it("lists seeded rooms after signup", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/signup").send(ada);
    const response = await agent.get("/api/rooms");
    expect(response.status).toBe(200);
    expect(response.body.map((room: { slug: string }) => room.slug)).toEqual(
      expect.arrayContaining(["general", "random"]),
    );
    expect(response.body[0].members[0].username).toBe("ada");
    expect(response.body[0].title).toBeTruthy();
  });

  it("creates a group visible only to the creator until someone joins", async () => {
    const adaAgent = request.agent(app.getHttpServer());
    const bobAgent = request.agent(app.getHttpServer());
    await adaAgent.post("/api/auth/signup").send(ada);
    await bobAgent.post("/api/auth/signup").send(bob);

    const created = await adaAgent.post("/api/rooms").send({ name: "standup" });
    expect(created.status).toBe(201);
    expect(created.body.kind).toBe("group");
    expect(created.body.title).toBe("standup");

    const bobRooms = await bobAgent.get("/api/rooms");
    expect(
      bobRooms.body.some((room: { title: string }) => room.title === "standup"),
    ).toBe(false);

    const denied = await bobAgent.get(`/api/rooms/${created.body.id}`);
    expect(denied.status).toBe(403);

    const directory = await bobAgent.get("/api/rooms/directory");
    expect(directory.status).toBe(200);
    const standup = directory.body.find(
      (room: { title: string }) => room.title === "standup",
    );
    expect(standup.joined).toBe(false);

    const joined = await bobAgent
      .post(`/api/rooms/${created.body.id}/join`)
      .send();
    expect(joined.status).toBe(201);
    expect(joined.body.members.map((m: { username: string }) => m.username)).toEqual(
      expect.arrayContaining(["ada", "bob"]),
    );

    const allowed = await bobAgent.get(`/api/rooms/${created.body.id}`);
    expect(allowed.status).toBe(200);
  });

  it("rejects an invalid group name", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/signup").send(ada);
    const response = await agent.post("/api/rooms").send({ name: "" });
    expect(response.status).toBe(400);
  });

  it("opens a DM and reuses the same conversation", async () => {
    const adaAgent = request.agent(app.getHttpServer());
    const bobAgent = request.agent(app.getHttpServer());
    await adaAgent.post("/api/auth/signup").send(ada);
    await bobAgent.post("/api/auth/signup").send(bob);

    const first = await adaAgent.post("/api/rooms/dm").send({ username: "bob" });
    expect(first.status).toBe(201);
    expect(first.body.kind).toBe("dm");
    expect(first.body.title).toBe("Bob Barker");

    const second = await bobAgent.post("/api/rooms/dm").send({ username: "ada" });
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.title).toBe("Ada Lovelace");
  });

  it("rejects messaging yourself or an unknown user", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/signup").send(ada);
    const self = await agent.post("/api/rooms/dm").send({ username: "ada" });
    expect(self.status).toBe(400);
    const missing = await agent
      .post("/api/rooms/dm")
      .send({ username: "nobody" });
    expect(missing.status).toBe(404);
  });

  it("lists other people and filters by query", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/signup").send(ada);
    await request(app.getHttpServer()).post("/api/auth/signup").send(bob);

    const all = await agent.get("/api/users");
    expect(all.status).toBe(200);
    expect(all.body.map((p: { username: string }) => p.username)).toEqual(["bob"]);

    const filtered = await agent.get("/api/users").query({ q: "ba" });
    expect(filtered.body).toHaveLength(1);

    const byName = await agent.get("/api/users").query({ q: "bark" });
    expect(byName.body[0]?.username).toBe("bob");

    const empty = await agent.get("/api/users").query({ q: "zzz" });
    expect(empty.body).toHaveLength(0);
  });

  it("hides people who chose not to appear in search", async () => {
    const adaAgent = request.agent(app.getHttpServer());
    const bobAgent = request.agent(app.getHttpServer());
    await adaAgent.post("/api/auth/signup").send(ada);
    await bobAgent.post("/api/auth/signup").send(bob);
    await bobAgent
      .patch("/api/auth/me")
      .send({ preferences: { visibility: "hidden" } });
    const listed = await adaAgent.get("/api/users");
    expect(listed.body).toEqual([]);
  });

  it("forbids joining a missing room", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/signup").send(ada);
    const response = await agent.post("/api/rooms/missing/join").send();
    expect(response.status).toBe(403);
  });
});
