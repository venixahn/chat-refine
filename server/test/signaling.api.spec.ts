import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { WebSocket } from "ws";
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

const listenPort = (app: INestApplication): number => {
  const address = app.getHttpServer().address() as AddressInfo;
  return address.port;
};

const openSocket = (port: number, ticket: string): Promise<WebSocket> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?ticket=${ticket}`);
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });

const nextEvent = (
  socket: WebSocket,
  predicate: (event: Record<string, unknown>) => boolean,
  timeoutMs = 2000,
): Promise<Record<string, unknown>> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("event timeout")), timeoutMs);
    const onMessage = (raw: WebSocket.RawData) => {
      const event = JSON.parse(String(raw)) as Record<string, unknown>;
      if (predicate(event)) {
        clearTimeout(timer);
        socket.off("message", onMessage);
        resolve(event);
      }
    };
    socket.on("message", onMessage);
  });

describe("signaling API", () => {
  let app: INestApplication;
  let dbDir: string;
  let db: DbService;
  let port: number;

  beforeAll(async () => {
    dbDir = await mkdtemp(join(tmpdir(), "chat-refine-signal-"));
    process.env.CHAT_REFINE_DB_PATH = join(dbDir, "db.json");
    process.env.SESSION_SECRET = "test-secret";
    app = await createApp();
    await app.listen(0, "127.0.0.1");
    db = app.get(DbService);
    port = listenPort(app);
  });

  afterAll(async () => {
    await app.close();
    await rm(dbDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await resetDirectory(db);
  });

  it("rejects an anonymous ticket", async () => {
    const response = await request(app.getHttpServer()).get("/api/signal/ticket");
    expect(response.status).toBe(401);
  });

  it("closes a socket without a valid ticket", async () => {
    const code = await new Promise<number>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      socket.once("close", (closeCode) => resolve(closeCode));
      socket.once("error", reject);
    });
    expect(code).toBe(4401);
  });

  it("joins members, forwards offers, and blocks strangers", async () => {
    const adaAgent = request.agent(app.getHttpServer());
    const bobAgent = request.agent(app.getHttpServer());
    const adaProfile = await adaAgent.post("/api/auth/signup").send(ada);
    await bobAgent.post("/api/auth/signup").send(bob);
    const adaTicket = await adaAgent.get("/api/signal/ticket");
    const bobTicket = await bobAgent.get("/api/signal/ticket");
    expect(adaTicket.status).toBe(200);
    expect(adaTicket.body.ticket).toBeTruthy();

    const adaSocket = await openSocket(port, adaTicket.body.ticket);
    const bobSocket = await openSocket(port, bobTicket.body.ticket);

    const adaJoined = nextEvent(adaSocket, (event) => event.type === "joined");
    adaSocket.send(JSON.stringify({ type: "join", conversationId: "room-general" }));
    expect((await adaJoined).peers).toEqual([]);

    const bobJoined = nextEvent(bobSocket, (event) => event.type === "joined");
    const adaSawBob = nextEvent(adaSocket, (event) => event.type === "peer-joined");
    bobSocket.send(JSON.stringify({ type: "join", conversationId: "room-general" }));
    const bobRoster = await bobJoined;
    expect((bobRoster.peers as { username: string }[])[0]?.username).toBe("ada");
    expect((await adaSawBob).peer).toMatchObject({ username: "bob" });

    const bobOffer = nextEvent(bobSocket, (event) => event.type === "offer");
    adaSocket.send(
      JSON.stringify({
        type: "offer",
        conversationId: "room-general",
        toUserId: (await bobAgent.get("/api/auth/me")).body.id,
        sdp: "v=0 ada-offer",
      }),
    );
    expect(await bobOffer).toMatchObject({
      type: "offer",
      fromUserId: adaProfile.body.id,
      sdp: "v=0 ada-offer",
    });

    const privateRoom = await adaAgent.post("/api/rooms").send({ name: "standup" });
    const forbidden = nextEvent(bobSocket, (event) => event.type === "error");
    bobSocket.send(
      JSON.stringify({ type: "join", conversationId: privateRoom.body.id }),
    );
    expect(await forbidden).toMatchObject({ code: "forbidden" });

    const notJoined = nextEvent(adaSocket, (event) => event.type === "error");
    adaSocket.send(
      JSON.stringify({
        type: "offer",
        conversationId: privateRoom.body.id,
        toUserId: (await bobAgent.get("/api/auth/me")).body.id,
        sdp: "v=0",
      }),
    );
    expect(await notJoined).toMatchObject({ code: "not-joined" });

    adaSocket.send(JSON.stringify({ type: "leave", conversationId: "room-general" }));
    const bobSawLeave = nextEvent(bobSocket, (event) => event.type === "peer-left");
    expect((await bobSawLeave).userId).toBe(adaProfile.body.id);

    adaSocket.close();
    bobSocket.close();
  });

  it("rejects a bad frame and a relay to a non-member", async () => {
    const adaAgent = request.agent(app.getHttpServer());
    const bobAgent = request.agent(app.getHttpServer());
    await adaAgent.post("/api/auth/signup").send(ada);
    const bobProfile = await bobAgent.post("/api/auth/signup").send(bob);
    const adaTicket = await adaAgent.get("/api/signal/ticket");
    const adaSocket = await openSocket(port, adaTicket.body.ticket);

    const badJson = nextEvent(adaSocket, (event) => event.type === "error");
    adaSocket.send("not-json");
    expect(await badJson).toMatchObject({ code: "bad-frame" });

    const badShape = nextEvent(adaSocket, (event) => event.type === "error");
    adaSocket.send(JSON.stringify({ type: "offer" }));
    expect(await badShape).toMatchObject({ code: "bad-frame" });

    adaSocket.send(JSON.stringify({ type: "join", conversationId: "room-general" }));
    await nextEvent(adaSocket, (event) => event.type === "joined");

    const forbidden = nextEvent(adaSocket, (event) => event.type === "error");
    const privateRoom = await adaAgent.post("/api/rooms").send({ name: "secrets" });
    adaSocket.send(JSON.stringify({ type: "join", conversationId: privateRoom.body.id }));
    await nextEvent(adaSocket, (event) => event.type === "joined");
    adaSocket.send(
      JSON.stringify({
        type: "ice",
        conversationId: privateRoom.body.id,
        toUserId: bobProfile.body.id,
        candidate: '{"candidate":"x"}',
      }),
    );
    expect(await forbidden).toMatchObject({ code: "forbidden" });

    adaSocket.close();
  });

  it("forwards activity to a member who has not joined", async () => {
    const adaAgent = request.agent(app.getHttpServer());
    const bobAgent = request.agent(app.getHttpServer());
    const adaProfile = await adaAgent.post("/api/auth/signup").send(ada);
    await bobAgent.post("/api/auth/signup").send(bob);
    const adaTicket = await adaAgent.get("/api/signal/ticket");
    const bobTicket = await bobAgent.get("/api/signal/ticket");
    const adaSocket = await openSocket(port, adaTicket.body.ticket);
    const bobSocket = await openSocket(port, bobTicket.body.ticket);

    adaSocket.send(JSON.stringify({ type: "join", conversationId: "room-general" }));
    await nextEvent(adaSocket, (event) => event.type === "joined");

    const bobSaw = nextEvent(bobSocket, (event) => event.type === "activity");
    adaSocket.send(
      JSON.stringify({
        type: "activity",
        conversationId: "room-general",
        preview: "hello inbox",
        createdAt: "2026-09-13T12:00:00.000Z",
        clientMessageId: "msg-ada-act-1",
      }),
    );
    expect(await bobSaw).toMatchObject({
      type: "activity",
      preview: "hello inbox",
      fromUserId: adaProfile.body.id,
    });

    const forbidden = nextEvent(bobSocket, (event) => event.type === "error");
    const privateRoom = await adaAgent.post("/api/rooms").send({ name: "quiet" });
    bobSocket.send(
      JSON.stringify({
        type: "activity",
        conversationId: privateRoom.body.id,
        preview: "nope",
        createdAt: "2026-09-13T12:00:01.000Z",
        clientMessageId: "msg-bob-act-1",
      }),
    );
    expect(await forbidden).toMatchObject({ code: "forbidden" });

    adaSocket.close();
    bobSocket.close();
  });

  it("relays call-state and requires a joined session", async () => {
    const adaAgent = request.agent(app.getHttpServer());
    const bobAgent = request.agent(app.getHttpServer());
    const adaProfile = await adaAgent.post("/api/auth/signup").send(ada);
    await bobAgent.post("/api/auth/signup").send(bob);
    const adaTicket = await adaAgent.get("/api/signal/ticket");
    const bobTicket = await bobAgent.get("/api/signal/ticket");
    const adaSocket = await openSocket(port, adaTicket.body.ticket);
    const bobSocket = await openSocket(port, bobTicket.body.ticket);

    adaSocket.send(JSON.stringify({ type: "join", conversationId: "room-general" }));
    expect((await nextEvent(adaSocket, (event) => event.type === "joined")).call).toEqual(
      [],
    );
    bobSocket.send(JSON.stringify({ type: "join", conversationId: "room-general" }));
    await nextEvent(bobSocket, (event) => event.type === "joined");
    await nextEvent(adaSocket, (event) => event.type === "peer-joined");

    const bobSawCall = nextEvent(bobSocket, (event) => event.type === "call-state");
    adaSocket.send(
      JSON.stringify({
        type: "call-state",
        conversationId: "room-general",
        inCall: true,
        audio: true,
        video: false,
      }),
    );
    expect(await bobSawCall).toMatchObject({
      type: "call-state",
      fromUserId: adaProfile.body.id,
      inCall: true,
      audio: true,
    });

    const late = nextEvent(adaSocket, (event) => event.type === "error");
    adaSocket.send(JSON.stringify({ type: "leave", conversationId: "room-general" }));
    await nextEvent(bobSocket, (event) => event.type === "peer-left");
    adaSocket.send(JSON.stringify({ type: "call-state", conversationId: "room-general", inCall: true, audio: true, video: false }));
    expect(await late).toMatchObject({ code: "not-joined" });

    adaSocket.close();
    bobSocket.close();
  });

  it("rejects an sfu-offer before the session joins", async () => {
    const adaAgent = request.agent(app.getHttpServer());
    await adaAgent.post("/api/auth/signup").send(ada);
    const adaTicket = await adaAgent.get("/api/signal/ticket");
    const adaSocket = await openSocket(port, adaTicket.body.ticket);
    const notJoined = nextEvent(adaSocket, (event) => event.type === "error");
    adaSocket.send(
      JSON.stringify({ type: "sfu-offer", conversationId: "room-general", sdp: "v=0" }),
    );
    expect(await notJoined).toMatchObject({ code: "not-joined" });
    adaSocket.close();
  });
});
