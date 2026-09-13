import { describe, expect, it } from "vitest";
import { filter, take } from "rxjs";
import { firstValueFrom } from "rxjs";
import { RTCPeerConnection } from "werift";
import { SignalingHub } from "./signaling.hub.ts";
import { SfuService } from "./sfu.service.ts";

describe("SfuService", () => {
  it("leave is a no-op when the room was never created", async () => {
    const sfu = new SfuService(new SignalingHub());
    await expect(sfu.leave("room-general", "ada")).resolves.toBeUndefined();
  });

  it("answers a caller offer", async () => {
    process.env.ICE_SERVERS = "[]";
    const hub = new SignalingHub();
    const joined = new Set(["room-general"]);
    const seen = firstValueFrom(
      hub.forSession("ada", () => joined).pipe(
        filter((envelope) => envelope.event.type === "sfu-answer"),
        take(1),
      ),
    );
    const sfu = new SfuService(hub);
    const client = new RTCPeerConnection({ iceServers: [] });
    client.addTransceiver("audio", { direction: "sendrecv" });
    const offer = await client.createOffer();
    await client.setLocalDescription(offer);
    await sfu.handleOffer("room-general", "ada", offer.sdp ?? "");
    expect((await seen).event.type).toBe("sfu-answer");
    await sfu.leave("room-general", "ada");
    await client.close();
  }, 15_000);
});
