import type { ChatMessage, SignalingPeer } from "@chat-refine/shared";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import type { PublicProfile } from "./auth-api.ts";
import { loadHistory, persistMessage } from "./local-history.ts";
import { createMesh, stubPeer, type Mesh } from "./mesh.ts";
import { signalTicket } from "./rooms-api.ts";
import { connectSignal } from "./signal-client.ts";

export type ChatSession = {
  send: (body: string) => void;
  notifyTyping: () => void;
  close: () => void;
};

export const startChatSession = async (input: {
  conversationId: string;
  self: PublicProfile;
  onMessages: (messages: ChatMessage[]) => void;
  onPeers: (peers: SignalingPeer[]) => void;
  onTyping: (names: string[]) => void;
  onStatus: (status: string) => void;
}): Promise<ChatSession> => {
  const roster = new Map<string, SignalingPeer>();
  const typingUntil = new Map<string, number>();
  let messages = loadHistory(input.conversationId);
  input.onMessages(messages);
  input.onStatus("Connecting…");

  const ticket = await signalTicket();
  if (!ticket.ok) {
    input.onStatus("Could not start signaling");
    throw new Error("Signal ticket failed");
  }

  const signal = connectSignal(ticket.data.ticket);
  await signal.ready;

  const publishPeers = () => {
    input.onPeers([...roster.values()]);
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

  const mesh: Mesh = createMesh({
    conversationId: input.conversationId,
    sendSignal: signal.send,
    onChannelOpen: (userId) => {
      mesh.sendTo(userId, {
        type: "history_request",
        conversationId: input.conversationId,
      });
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
      mesh.drop(event.userId);
      publishPeers();
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
    close: () => {
      clearInterval(typingTimer);
      typingSub.unsubscribe();
      typing$.complete();
      subscription.unsubscribe();
      signal.send({ type: "leave", conversationId: input.conversationId });
      mesh.close();
      signal.close();
    },
  };
};
