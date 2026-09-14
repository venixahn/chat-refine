import {
  applyCallState,
  avPeerCount,
  canAddAvPeer,
  iceConfigSchema,
  newId,
  previewOf,
  type CallPresence,
  type ChatMessage,
  type P2pEvent,
  type SignalingEvent,
  type SignalingPeer,
} from "@chat-refine/shared";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import type { PublicProfile } from "./auth-api.ts";
import { captureLocal } from "./capture.ts";
import { loadHistory, persistAll, persistMessage } from "./local-history.ts";
import { createMesh, stubPeer, type Mesh } from "./mesh.ts";
import { createSfuLink } from "./sfu-link.ts";
import {
  listIce,
  listMessages,
  markRead,
  postMessage,
  postMessageFile,
  editMessage,
  deleteMessage,
  signalTicket,
} from "./rooms-api.ts";
import { meshStatus } from "./mesh-status.ts";
import { liveTypers, rememberPeers, remoteTiles } from "./session-state.ts";

export type RemoteMedia = {
  userId: string;
  stream: MediaStream | null;
};

export type OutgoingMessage = {
  body: string;
  file?: File;
};

export type ChatSession = {
  send: (outgoing: OutgoingMessage) => Promise<void>;
  editMessage: (messageId: string, body: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  notifyTyping: () => void;
  joinCall: () => Promise<void>;
  leaveCall: () => Promise<void>;
  setMuted: (muted: boolean) => void;
  setCamera: (on: boolean) => Promise<void>;
  close: () => void;
};

const mergeRemoteHistory = async (
  conversationId: string,
  apply: (item: ChatMessage) => void,
) => {
  const remote = await listMessages(conversationId);
  if (remote.ok) {
    remote.data.forEach(apply);
  }
};

const fromPeerMessage = (
  fromUserId: string,
  event: Extract<P2pEvent, { type: "message" }>,
): ChatMessage => ({
  clientMessageId: event.clientMessageId,
  conversationId: event.conversationId,
  body: event.body,
  createdAt: event.createdAt,
  fromUserId,
  editedAt: event.editedAt,
  deletedAt: event.deletedAt,
  attachment: event.attachment
    ? {
        name: event.attachment.name,
        mime: event.attachment.mime,
        size: event.attachment.size,
      }
    : undefined,
});

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
  onAttached?: (session: ChatSession) => void;
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
    messages = persistAll(input.conversationId, remote.data);
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
    input.onRemoteStreams(remoteTiles(remoteByUser));
  };

  const publishCall = () => {
    input.onCallRoster(callRoster);
  };

  const refreshTyping = () => {
    const live = liveTypers(typingUntil, roster, Date.now());
    typingUntil.clear();
    live.next.forEach((expires, userId) => typingUntil.set(userId, expires));
    input.onTyping(live.names);
  };

  const apply = (incoming: ChatMessage) => {
    messages = persistMessage(input.conversationId, incoming);
    input.onMessages(messages);
  };

  const publishLine = (posted: ChatMessage) => {
    apply(posted);
    mesh.broadcast({
      type: "message",
      clientMessageId: posted.clientMessageId,
      conversationId: posted.conversationId,
      body: posted.body,
      createdAt: posted.createdAt,
      editedAt: posted.editedAt,
      deletedAt: posted.deletedAt,
      attachment: posted.attachment,
    });
    signal.send({
      type: "activity",
      conversationId: input.conversationId,
      preview: previewOf(posted).slice(0, 180),
      createdAt: posted.editedAt ?? posted.deletedAt ?? posted.createdAt,
      clientMessageId: posted.clientMessageId,
    });
    window.dispatchEvent(new Event("chat-refine:activity"));
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
    applyRemoteCall(fromUserId, event);
  };

  const applyRemoteCall = (
    userId: string,
    state: { inCall: boolean; audio: boolean; video: boolean },
  ) => {
    callRoster = applyCallState(callRoster, userId, state);
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
      }
    },
    onEvent: (fromUserId, event) => {
      onPeerEvent(fromUserId, event);
    },
    onState: () => {
      input.onStatus(meshStatus(mesh.openCount(), roster.size));
    },
  });

  const sfu = createSfuLink({
    conversationId: input.conversationId,
    iceServers,
    send: signal.send,
    onRemote: (userId, stream) => {
      if (stream) {
        remoteByUser.set(userId, stream);
      } else {
        remoteByUser.delete(userId);
      }
      publishRemote();
    },
  });

  const announceCall = () => {
    const state = currentCallState();
    signal.send(state);
    mesh.broadcast(state);
  };

  const revertCall = async () => {
    inCall = false;
    callRoster = applyCallState(callRoster, input.self.id, {
      inCall: false,
      audio: false,
      video: false,
    });
    publishCall();
    sfu.close();
    stopLocal();
  };

  const onJoined = (event: Extract<SignalingEvent, { type: "joined" }>) => {
    rememberPeers(roster, event.peers);
    callRoster = event.call;
    publishPeers();
    publishCall();
    input.onStatus(meshStatus(0, event.peers.length));
    void mergeRemoteHistory(input.conversationId, apply);
  };

  const onPeerLeft = (userId: string) => {
    roster.delete(userId);
    typingUntil.delete(userId);
    applyRemoteCall(userId, { inCall: false, audio: false, video: false });
    mesh.drop(userId);
    publishPeers();
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
    "call-state": (event) => {
      applyRemoteCall(event.fromUserId, event);
    },
    "sfu-offer": (event) => {
      void sfu.handleOffer(event.sdp);
    },
    "sfu-answer": (event) => {
      void sfu.handleAnswer(event.sdp);
    },
    "sfu-ice": (event) => {
      void sfu.handleIce(event.candidate);
    },
    "sfu-route": (event) => {
      sfu.handleRoute(event.fromUserId, event.mid);
    },
    error: (event) => {
      input.onStatus(event.message);
      if (event.code === "call-full") {
        void revertCall();
        input.onCallError(event.message);
      }
    },
    activity: (event) => {
      if (event.conversationId === input.conversationId) {
        void mergeRemoteHistory(input.conversationId, apply);
      }
    },
  };

  const subscription = signal.events$.subscribe((event) => {
    const handle = signalHandlers[event.type] as
      | ((value: SignalingEvent) => void)
      | undefined;
    handle?.(event);
  });

  const typing$ = new Subject<void>();
  const typingSub = typing$.pipe(debounceTime(300)).subscribe(() => {
    mesh.broadcast({
      type: "typing",
      conversationId: input.conversationId,
    });
  });
  const typingTimer = setInterval(refreshTyping, 800);

  const leaveCall = async () => {
    await revertCall();
    announceCall();
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
    await sfu.replaceKind("video", video);
  };

  const stripVideoTracks = async () => {
    if (!localStream) {
      return;
    }
    localStream.getVideoTracks().forEach((track) => {
      track.stop();
      localStream?.removeTrack(track);
    });
    await sfu.replaceKind("video", null);
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

  const session: ChatSession = {
    send: async (outgoing) => {
      const trimmed = outgoing.body.trim();
      if (!trimmed && !outgoing.file) {
        return;
      }
      const createdAt = new Date().toISOString();
      const clientMessageId = newId();
      const posted = outgoing.file
        ? await postMessageFile(input.conversationId, {
            clientMessageId,
            body: trimmed,
            createdAt,
            file: outgoing.file,
          })
        : await postMessage(input.conversationId, {
            clientMessageId,
            body: trimmed,
            createdAt,
          });
      if (!posted.ok) {
        input.onStatus("Could not save that message");
        throw new Error("Could not save that message");
      }
      publishLine(posted.data);
    },
    editMessage: async (messageId, body) => {
      const posted = await editMessage(input.conversationId, messageId, body);
      if (!posted.ok) {
        throw new Error("Could not edit that message");
      }
      publishLine(posted.data);
    },
    deleteMessage: async (messageId) => {
      const posted = await deleteMessage(input.conversationId, messageId);
      if (!posted.ok) {
        throw new Error("Could not delete that message");
      }
      publishLine(posted.data);
    },
    notifyTyping: () => {
      typing$.next();
    },
    joinCall: async () => {
      if (inCall) {
        return;
      }
      const others = callRoster.filter((item) => item.userId !== input.self.id);
      if (!canAddAvPeer(avPeerCount(others))) {
        input.onCallError(`Call is full (${avPeerCount(others)} peers)`);
        return;
      }
      input.onCallError(null);
      try {
        localStream = await captureLocal();
      } catch (error) {
        input.onCallError(
          error instanceof Error
            ? error.message
            : "Could not access microphone or camera",
        );
        return;
      }
      inCall = true;
      callRoster = applyCallState(callRoster, input.self.id, currentCallState());
      publishCall();
      input.onLocalStream(localStream);
      sfu.attach(localStream);
      announceCall();
    },
    leaveCall,
    setMuted: (muted) => {
      localStream?.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
      if (inCall) {
        announceCall();
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
      announceCall();
    },
    close: () => {
      clearInterval(typingTimer);
      typingSub.unsubscribe();
      typing$.complete();
      subscription.unsubscribe();
      inCall = false;
      sfu.close();
      stopLocal();
      signal.send({ type: "leave", conversationId: input.conversationId });
      mesh.close();
      signal.close();
    },
  };
  input.onAttached?.(session);
  signal.send({ type: "join", conversationId: input.conversationId });
  return session;
};
