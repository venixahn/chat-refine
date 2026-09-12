import { describe, expect, it } from "vitest";
import { firstValueFrom, isEmpty, take } from "rxjs";
import { SignalingHub } from "./signaling.hub.ts";

describe("SignalingHub", () => {
  it("delivers a room event except to the sender", async () => {
    const hub = new SignalingHub();
    const joined = new Set(["room-general"]);
    const seen = firstValueFrom(hub.forSession("bob", () => joined).pipe(take(1)));
    hub.publish({
      conversationId: "room-general",
      exceptUserId: "ada",
      event: {
        type: "peer-left",
        conversationId: "room-general",
        userId: "ada",
      },
    });
    expect((await seen).event.type).toBe("peer-left");
  });

  it("drops events for rooms the session has not joined", async () => {
    const hub = new SignalingHub();
    const empty = firstValueFrom(
      hub.forSession("bob", () => new Set()).pipe(isEmpty()),
    );
    hub.publish({
      conversationId: "room-general",
      event: {
        type: "peer-left",
        conversationId: "room-general",
        userId: "ada",
      },
    });
    hub.frames$.complete();
    expect(await empty).toBe(true);
  });
});
