import {
  applyCallState,
  avPeerCount,
  canAddAvPeer,
  iceConfigSchema,
  previewOf,
  type CallPresence,
  type ChatMessage,
  type MessageAttachment,
  type P2pEvent,
  type SignalingEvent,
  type SignalingPeer,
} from "@chat-refine/shared";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import type { PublicProfile } from "./auth-api.ts";
import type { FilePayload } from "./file.ts";
import { loadHistory, persistMessage } from "./local-history.ts";
import { createMesh, stubPeer, type Mesh } from "./mesh.ts";
import { listIce, listMessages, markRead, postMessage, signalTicket } from "./rooms-api.ts";
import { connectSignal } from "./signal-client.ts";

export type RemoteMedia = {
  userId: string;
  stream: MediaStream | null;
};

export type OutgoingMessage = {
  body: string;
  attachment?: FilePayload;
};

export type ChatSession = {
  send: (outgoing: OutgoingMessage) => Promise<void>;
  notifyTyping: () => void;
  joinCall: () => Promise<void>;
  leaveCall: () => Promise<void>;
  setMuted: (muted: boolean) => void;
  setCamera: (on: boolean) => Promise<void>;
  close: () => void;
};

const metaOf = (file?: FilePayload): MessageAttachment | undefined =>
  file
    ? {
        name: file.name,
        mime: file.mime,
        size: Math.floor((file.data.length * 3) / 4),
      }
    : undefined;

const fromPeerMessage = (
  fromUserId: string,
  event: Extract<P2pEvent, { type: "message" }>,
): ChatMessage => ({
  clientMessageId: event.clientMessageId,
  conversationId: event.conversationId,
  body: event.body,
  createdAt: event.createdAt,
  fromUserId,
  attachment: event.attachment
    ? {
        name: event.attachment.name,
        mime: event.attachment.mime,
        size: event.attachment.size,
      }
    : undefined,
});

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

  const [ticket, ice, remote] = await Promise.all([
    signalTicket(),
    listIce(),
    listMessages(input.conversationId),
  ]);
  if (remote.ok) {
    for (const item of remote.data) {
      messages = persistMessage(input.conversationId, item);
    }
    input.onMessages(messages);
    void markRead(input.conversationId);
  }
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

  const onPeerEvent = (fromUserId: string, event: P2pEvent) => {
    if (event.type === "message") {
      apply(fromPeerMessage(fromUserId, event));
      void markRead(input.conversationId);
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
      event.messages.forEach(apply);
      return;
    }
    callRoster = applyCallState(callRoster, fromUserId, event);
    publishCall();
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
      onPeerEvent(fromUserId, event);
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

  const onJoined = (event: Extract<SignalingEvent, { type: "joined" }>) => {
    for (const peer of event.peers) {
      roster.set(peer.userId, peer);
    }
    publishPeers();
    input.onStatus(
      event.peers.length === 0 ? "Waiting for peers" : "Connecting peers…",
    );
  };

  const onPeerLeft = (userId: string) => {
    roster.delete(userId);
    typingUntil.delete(userId);
    callRoster = applyCallState(callRoster, userId, {
      inCall: false,
      audio: false,
      video: false,
    });
    mesh.drop(userId);
    publishPeers();
    publishCall();
    refreshTyping();
  };

  const signalHandlers: {
    [K in SignalingEvent["type"]]?: (event: Extract<SignalingEvent, { type: K }>) => void;
  } = {
    joined: onJoined,
    "peer-joined": (event) => {
      roster.set(event.peer.userId, event.peer);
      publishPeers();
      void mesh.offerTo(event.peer);
    },
    "peer-left": (event) => {
      onPeerLeft(event.userId);
    },
    offer: (event) => {
      void mesh.acceptOffer(
        roster.get(event.fromUserId) ?? stubPeer(event.fromUserId),
        event.sdp,
      );
    },
    answer: (event) => {
      void mesh.handleAnswer(event.fromUserId, event.sdp);
    },
    ice: (event) => {
      void mesh.handleIce(event.fromUserId, event.candidate);
    },
    error: (event) => {
      input.onStatus(event.message);
    },
  };

  const subscription = signal.events$.subscribe((event) => {
    const handle = signalHandlers[event.type] as
      | ((value: SignalingEvent) => void)
      | undefined;
    handle?.(event);
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

  const hasLiveVideo = () =>
    Boolean(
      localStream?.getVideoTracks().some((track) => track.readyState === "live"),
    );

  const addCameraTrack = async () => {
    const extra = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = extra.getVideoTracks()[0];
    if (!video || !localStream) {
      return;
    }
    localStream.addTrack(video);
    await mesh.replaceMediaTrack("video", video);
  };

  const stripVideoTracks = async () => {
    if (!localStream) {
      return;
    }
    localStream.getVideoTracks().forEach((track) => {
      track.stop();
      localStream?.removeTrack(track);
    });
    await mesh.replaceMediaTrack("video", null);
  };

  const applyCamera = async (on: boolean) => {
    if (!on) {
      await stripVideoTracks();
      return;
    }
    if (hasLiveVideo()) {
      localStream?.getVideoTracks().forEach((track) => {
        track.enabled = true;
      });
      return;
    }
    await addCameraTrack();
  };

  return {
    send: async (outgoing) => {
      const trimmed = outgoing.body.trim();
      if (!trimmed && !outgoing.attachment) {
        return;
      }
      const createdAt = new Date().toISOString();
      const clientMessageId = crypto.randomUUID();
      const posted = await postMessage(input.conversationId, {
        clientMessageId,
        body: trimmed,
        createdAt,
        attachment: outgoing.attachment,
      });
      if (!posted.ok) {
        input.onStatus("Could not save that message");
        return;
      }
      apply(posted.data);
      mesh.broadcast({
        type: "message",
        clientMessageId,
        conversationId: input.conversationId,
        body: trimmed,
        createdAt,
        attachment: outgoing.attachment
          ? { ...metaOf(outgoing.attachment), data: outgoing.attachment.data }
          : posted.data.attachment,
      });
      signal.send({
        type: "activity",
        conversationId: input.conversationId,
        preview: previewOf(posted.data).slice(0, 180),
        createdAt,
        clientMessageId,
      });
      window.dispatchEvent(new Event("chat-refine:activity"));
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
      try {
        await applyCamera(on);
      } catch {
        input.onCallError("Could not start the camera");
        return;
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
