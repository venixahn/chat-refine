import {
  applyCallState,
  avPeerCount,
  canAddAvPeer,
  iceConfigSchema,
  type CallPresence,
  type ChatMessage,
  type SignalingPeer,
} from "@chat-refine/shared";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import type { PublicProfile } from "./auth-api.ts";
import { loadHistory, persistMessage } from "./local-history.ts";
import { createMesh, stubPeer, type Mesh } from "./mesh.ts";
import { listIce, signalTicket } from "./rooms-api.ts";
import { connectSignal } from "./signal-client.ts";

export type RemoteMedia = {
  userId: string;
  stream: MediaStream | null;
};

export type ChatSession = {
  send: (body: string) => void;
  notifyTyping: () => void;
  joinCall: () => Promise<void>;
  leaveCall: () => Promise<void>;
  setMuted: (muted: boolean) => void;
  setCamera: (on: boolean) => Promise<void>;
  close: () => void;
};

const captureLocal = async (): Promise<MediaStream> => {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
  } catch {
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  }
};

export const startChatSession = async (input: {
  conversationId: string;
  self: PublicProfile;
  onMessages: (messages: ChatMessage[]) => void;
  onPeers: (peers: SignalingPeer[]) => void;
  onTyping: (names: string[]) => void;
  onStatus: (status: string) => void;
  onLocalStream: (stream: MediaStream | null) => void;
  onRemoteStreams: (streams: RemoteMedia[]) => void;
  onCallRoster: (roster: CallPresence[]) => void;
  onCallError: (message: string | null) => void;
}): Promise<ChatSession> => {
  const roster = new Map<string, SignalingPeer>();
  const typingUntil = new Map<string, number>();
  const remoteByUser = new Map<string, MediaStream | null>();
  let callRoster: CallPresence[] = [];
  let localStream: MediaStream | null = null;
  let inCall = false;
  let messages = loadHistory(input.conversationId);
  input.onMessages(messages);
  input.onStatus("Connecting…");

  const [ticket, ice] = await Promise.all([signalTicket(), listIce()]);
  if (!ticket.ok) {
    input.onStatus("Could not start signaling");
    throw new Error("Signal ticket failed");
  }
  const parsedIce = ice.ok ? iceConfigSchema.safeParse(ice.data) : null;
  const iceServers = parsedIce?.success ? parsedIce.data.iceServers : [];

  const signal = connectSignal(ticket.data.ticket);
  await signal.ready;

  const publishPeers = () => {
    input.onPeers([...roster.values()]);
  };

  const publishRemote = () => {
    input.onRemoteStreams(
      [...remoteByUser.entries()].map(([userId, stream]) => ({ userId, stream })),
    );
  };

  const publishCall = () => {
    input.onCallRoster(callRoster);
  };

  const refreshTyping = () => {
    const now = Date.now();
    const names: string[] = [];
    for (const [userId, expires] of typingUntil) {
      if (expires <= now) {
        typingUntil.delete(userId);
        continue;
      }
      const peer = roster.get(userId);
      if (peer) {
        names.push(peer.displayName);
      }
    }
    input.onTyping(names);
  };

  const apply = (incoming: ChatMessage) => {
    messages = persistMessage(input.conversationId, incoming);
    input.onMessages(messages);
  };

  const currentCallState = () => ({
    type: "call-state" as const,
    conversationId: input.conversationId,
    inCall,
    audio: Boolean(localStream?.getAudioTracks().some((track) => track.enabled)),
    video: Boolean(localStream?.getVideoTracks().some((track) => track.readyState === "live")),
  });

  const stopLocal = () => {
    localStream?.getTracks().forEach((track) => track.stop());
    localStream = null;
    input.onLocalStream(null);
  };

  const mesh: Mesh = createMesh({
    conversationId: input.conversationId,
    selfId: input.self.id,
    iceServers,
    sendSignal: signal.send,
    onChannelOpen: (userId) => {
      mesh.sendTo(userId, {
        type: "history_request",
        conversationId: input.conversationId,
      });
      if (inCall) {
        mesh.sendTo(userId, currentCallState());
        if (localStream) {
          void mesh.attachLocalStream(localStream).then(() => mesh.renegotiate(userId));
        }
      }
    },
    onRemoteStream: (userId, stream) => {
      if (stream) {
        remoteByUser.set(userId, stream);
      } else {
        remoteByUser.delete(userId);
      }
      publishRemote();
    },
    onEvent: (fromUserId, event) => {
      if (event.type === "message") {
        apply({
          clientMessageId: event.clientMessageId,
          conversationId: event.conversationId,
          body: event.body,
          createdAt: event.createdAt,
          fromUserId,
        });
        return;
      }
      if (event.type === "typing") {
        typingUntil.set(fromUserId, Date.now() + 2500);
        refreshTyping();
        return;
      }
      if (event.type === "history_request") {
        mesh.sendTo(fromUserId, {
          type: "history_batch",
          conversationId: input.conversationId,
          messages,
        });
        return;
      }
      if (event.type === "history_batch") {
        for (const item of event.messages) {
          apply(item);
        }
        return;
      }
      if (event.type === "call-state") {
        callRoster = applyCallState(callRoster, fromUserId, event);
        publishCall();
      }
    },
    onState: () => {
      const open = mesh.openCount();
      input.onStatus(
        open === 0
          ? roster.size === 0
            ? "Waiting for peers"
            : "Connecting peers…"
          : `Connected · ${open} peer${open === 1 ? "" : "s"}`,
      );
    },
  });

  const subscription = signal.events$.subscribe((event) => {
    if (event.type === "joined") {
      for (const peer of event.peers) {
        roster.set(peer.userId, peer);
      }
      publishPeers();
      input.onStatus(
        event.peers.length === 0 ? "Waiting for peers" : "Connecting peers…",
      );
      return;
    }
    if (event.type === "peer-joined") {
      roster.set(event.peer.userId, event.peer);
      publishPeers();
      void mesh.offerTo(event.peer);
      return;
    }
    if (event.type === "peer-left") {
      roster.delete(event.userId);
      typingUntil.delete(event.userId);
      callRoster = applyCallState(callRoster, event.userId, {
        inCall: false,
        audio: false,
        video: false,
      });
      mesh.drop(event.userId);
      publishPeers();
      publishCall();
      refreshTyping();
      return;
    }
    if (event.type === "offer") {
      void mesh.acceptOffer(
        roster.get(event.fromUserId) ?? stubPeer(event.fromUserId),
        event.sdp,
      );
      return;
    }
    if (event.type === "answer") {
      void mesh.handleAnswer(event.fromUserId, event.sdp);
      return;
    }
    if (event.type === "ice") {
      void mesh.handleIce(event.fromUserId, event.candidate);
      return;
    }
    input.onStatus(event.message);
  });

  signal.send({ type: "join", conversationId: input.conversationId });

  const typing$ = new Subject<void>();
  const typingSub = typing$.pipe(debounceTime(300)).subscribe(() => {
    mesh.broadcast({
      type: "typing",
      conversationId: input.conversationId,
    });
  });
  const typingTimer = setInterval(refreshTyping, 800);

  const leaveCall = async () => {
    inCall = false;
    await mesh.detachLocalStream();
    stopLocal();
    await mesh.renegotiate();
    mesh.broadcast(currentCallState());
    input.onCallError(null);
  };

  return {
    send: (body) => {
      const trimmed = body.trim();
      if (!trimmed) {
        return;
      }
      const createdAt = new Date().toISOString();
      const clientMessageId = crypto.randomUUID();
      apply({
        clientMessageId,
        conversationId: input.conversationId,
        body: trimmed,
        createdAt,
        fromUserId: input.self.id,
      });
      mesh.broadcast({
        type: "message",
        clientMessageId,
        conversationId: input.conversationId,
        body: trimmed,
        createdAt,
      });
    },
    notifyTyping: () => {
      typing$.next();
    },
    joinCall: async () => {
      if (inCall) {
        return;
      }
      if (!canAddAvPeer(avPeerCount(callRoster))) {
        input.onCallError(`Call is full (${avPeerCount(callRoster)} peers)`);
        return;
      }
      input.onCallError(null);
      try {
        localStream = await captureLocal();
      } catch {
        input.onCallError("Could not access microphone or camera");
        return;
      }
      inCall = true;
      input.onLocalStream(localStream);
      await mesh.attachLocalStream(localStream);
      await mesh.renegotiate();
      mesh.broadcast(currentCallState());
    },
    leaveCall,
    setMuted: (muted) => {
      localStream?.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
      if (inCall) {
        mesh.broadcast(currentCallState());
      }
    },
    setCamera: async (on) => {
      if (!inCall || !localStream) {
        return;
      }
      if (on) {
        if (localStream.getVideoTracks().some((track) => track.readyState === "live")) {
          localStream.getVideoTracks().forEach((track) => {
            track.enabled = true;
          });
        } else {
          try {
            const extra = await navigator.mediaDevices.getUserMedia({ video: true });
            const video = extra.getVideoTracks()[0];
            if (video) {
              localStream.addTrack(video);
              await mesh.replaceMediaTrack("video", video);
            }
          } catch {
            input.onCallError("Could not start the camera");
            return;
          }
        }
      } else {
        for (const track of localStream.getVideoTracks()) {
          track.stop();
          localStream.removeTrack(track);
        }
        await mesh.replaceMediaTrack("video", null);
      }
      input.onLocalStream(localStream);
      mesh.broadcast(currentCallState());
    },
    close: () => {
      clearInterval(typingTimer);
      typingSub.unsubscribe();
      typing$.complete();
      subscription.unsubscribe();
      inCall = false;
      void mesh.detachLocalStream();
      stopLocal();
      signal.send({ type: "leave", conversationId: input.conversationId });
      mesh.close();
      signal.close();
    },
  };
};
