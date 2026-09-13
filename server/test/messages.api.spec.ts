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

const pngDot =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

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

describe("messages API", () => {
  let app: INestApplication;
  let dbDir: string;
  let db: DbService;

  beforeAll(async () => {
    dbDir = await mkdtemp(join(tmpdir(), "chat-refine-messages-"));
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

  it("persists a message, lists it, and tracks unread until read", async () => {
    const adaAgent = request.agent(app.getHttpServer());
    const bobAgent = request.agent(app.getHttpServer());
    await adaAgent.post("/api/auth/signup").send(ada);
    await bobAgent.post("/api/auth/signup").send(bob);

    const posted = await adaAgent.post("/api/rooms/room-general/messages").send({
      clientMessageId: "msg-ada-hello-1",
      body: "hello inbox",
      createdAt: "2026-09-13T12:00:00.000Z",
    });
    expect(posted.status).toBe(201);
    expect(posted.body.body).toBe("hello inbox");
    expect(posted.body.fromUserId).toBeTruthy();

    const again = await adaAgent.post("/api/rooms/room-general/messages").send({
      clientMessageId: "msg-ada-hello-1",
      body: "changed",
    });
    expect(again.status).toBe(201);
    expect(again.body.body).toBe("hello inbox");

    const listed = await bobAgent.get("/api/rooms/room-general/messages");
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);

    const bobRooms = await bobAgent.get("/api/rooms");
    const general = bobRooms.body.find(
      (room: { slug: string }) => room.slug === "general",
    );
    expect(general.lastMessage.body).toBe("hello inbox");
    expect(general.unreadCount).toBe(1);

    const adaRooms = await adaAgent.get("/api/rooms");
    const adaGeneral = adaRooms.body.find(
      (room: { slug: string }) => room.slug === "general",
    );
    expect(adaGeneral.unreadCount).toBe(0);

    const read = await bobAgent.post("/api/rooms/room-general/read").send();
    expect(read.status).toBe(201);
    const afterRead = await bobAgent.get("/api/rooms");
    const bobGeneral = afterRead.body.find(
      (room: { slug: string }) => room.slug === "general",
    );
    expect(bobGeneral.unreadCount).toBe(0);
  });

  it("stores an image and returns the raw bytes", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/signup").send(ada);
    const posted = await agent.post("/api/rooms/room-general/messages").send({
      clientMessageId: "msg-ada-file-01",
      body: "",
      attachment: {
        name: "dot.png",
        mime: "image/png",
        data: pngDot,
      },
    });
    expect(posted.status).toBe(201);
    expect(posted.body.attachment).toEqual({
      name: "dot.png",
      mime: "image/png",
      size: Buffer.from(pngDot, "base64").length,
    });
    expect(posted.body.attachment.data).toBeUndefined();

    const file = await agent.get(
      `/api/rooms/room-general/messages/${posted.body.clientMessageId}/file`,
    );
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toMatch(/image\/png/);
    expect(file.body).toBeInstanceOf(Buffer);
  });

  it("rejects empty bodies, bad files, and outsiders", async () => {
    const adaAgent = request.agent(app.getHttpServer());
    const bobAgent = request.agent(app.getHttpServer());
    await adaAgent.post("/api/auth/signup").send(ada);
    await bobAgent.post("/api/auth/signup").send(bob);
    const privateRoom = await adaAgent.post("/api/rooms").send({ name: "secrets" });

    const empty = await adaAgent.post("/api/rooms/room-general/messages").send({
      clientMessageId: "msg-ada-empty-1",
      body: "   ",
    });
    expect(empty.status).toBe(400);

    const badFile = await adaAgent.post("/api/rooms/room-general/messages").send({
      clientMessageId: "msg-ada-badfile1",
      body: "",
      attachment: {
        name: "x.exe",
        mime: "application/x-msdownload",
        data: pngDot,
      },
    });
    expect(badFile.status).toBe(400);

    const denied = await bobAgent
      .post(`/api/rooms/${privateRoom.body.id}/messages`)
      .send({ clientMessageId: "msg-bob-nope-01", body: "hi" });
    expect(denied.status).toBe(403);

    const missingFile = await adaAgent.get(
      "/api/rooms/room-general/messages/missing-message/file",
    );
    expect(missingFile.status).toBe(404);
  });
});
