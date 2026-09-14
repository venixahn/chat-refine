import { useParams } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";
import { canAddAvPeer, type CallPresence, type ChatMessage } from "@chat-refine/shared";
import { ConversationPane } from "../components/conversation-pane.tsx";
import { me } from "../lib/auth-api.ts";
import {
  startChatSession,
  type ChatSession,
  type RemoteMedia,
} from "../lib/chat-session.ts";
import { packAttachments } from "../lib/file.ts";
import { callCountLabel } from "../lib/call-labels.ts";
import {
  getRoom,
  inviteToRoom,
  muteRoom,
  patchRoomTopic,
  type RoomView,
} from "../lib/rooms-api.ts";

const failText = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const postDraft = async (
  session: ChatSession | undefined,
  body: string,
  file: File | null,
): Promise<void> => {
  if (!session) {
    throw new Error("Still connecting — try Send again.");
  }
  await session.send({ body, file: file ?? undefined });
};

export const ConversationPage = () => {
  const params = useParams();
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [status, setStatus] = createSignal("Connecting…");
  const [typing, setTyping] = createSignal<string[]>([]);
  const [draft, setDraft] = createSignal("");
  const [file, setFile] = createSignal<File | null>(null);
  const [sendError, setSendError] = createSignal<string | null>(null);
  const [roomError, setRoomError] = createSignal<string | null>(null);
  const [session, setSession] = createSignal<ChatSession | undefined>();
  const [localStream, setLocalStream] = createSignal<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = createSignal<RemoteMedia[]>([]);
  const [callRoster, setCallRoster] = createSignal<CallPresence[]>([]);
  const [callError, setCallError] = createSignal<string | null>(null);
  const [muted, setMuted] = createSignal(false);
  const [cameraOn, setCameraOn] = createSignal(true);
  const [search, setSearch] = createSignal("");
  const [unreadSince, setUnreadSince] = createSignal("9999");
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editDraft, setEditDraft] = createSignal("");
  const [topicDraft, setTopicDraft] = createSignal("");
  const [inviteName, setInviteName] = createSignal("");
  const [liveRoom, setLiveRoom] = createSignal<RoomView | null>(null);

  const [profile] = createResource(() =>
    me().then((result) => (result.ok ? result.data : null)),
  );
  const [room] = createResource(
    () => params.id,
    async (id) => {
      const result = await getRoom(id);
      setRoomError(result.ok ? null : "You cannot open this room.");
      return result.ok ? result.data : null;
    },
  );

  const authors = createMemo(() => {
    const names = new Map<string, string>();
    const avatars = new Map<string, string | null>();
    for (const member of (liveRoom() ?? room())?.members ?? []) {
      names.set(member.id, member.displayName);
      avatars.set(member.id, member.avatarUrl);
    }
    const self = profile();
    if (self) {
      names.set(self.id, self.displayName);
      avatars.set(self.id, self.avatarUrl);
    }
    return { names, avatars };
  });

  const inCall = () => localStream() !== null;
  const othersInCall = () =>
    callRoster().filter((item) => item.userId !== profile()?.id);
  const callFull = () => !inCall() && !canAddAvPeer(othersInCall().length);

  createEffect(() => {
    const current = room();
    const id = params.id;
    if (!current || current.id !== id) {
      return;
    }
    setLiveRoom(current);
    setTopicDraft(current.topic);
    setUnreadSince(current.lastReadAt);
    setSearch("");
    setEditingId(null);
    setInviteName("");
  });

  createEffect(() => {
    const conversationId = params.id;
    const self = profile();
    const currentRoom = room();
    if (!conversationId || !self || !currentRoom) {
      return;
    }
    let active: ChatSession | undefined;
    let cancelled = false;
    void startChatSession({
      conversationId,
      self,
      onMessages: setMessages,
      onPeers: () => undefined,
      onTyping: setTyping,
      onStatus: setStatus,
      onLocalStream: setLocalStream,
      onRemoteStreams: setRemoteStreams,
      onCallRoster: setCallRoster,
      onCallError: setCallError,
      onAttached: (started) => {
        if (cancelled) {
          started.close();
          return;
        }
        active = started;
        setSession(started);
      },
    }).catch(() => {
      if (!cancelled) {
        setStatus("Could not connect signaling");
      }
    });
    onCleanup(() => {
      cancelled = true;
      active?.close();
      setSession(undefined);
      setLocalStream(null);
      setRemoteStreams([]);
      setCallRoster([]);
    });
  });

  let scroller: HTMLElement | undefined;
  let jumpedUnread = false;

  createEffect(() => {
    void params.id;
    jumpedUnread = false;
  });

  createEffect(() => {
    messages();
    unreadSince();
    if (editingId()) {
      return;
    }
    queueMicrotask(() => {
      if (!scroller) {
        return;
      }
      const anchor = scroller.querySelector("[data-unread='true']");
      if (anchor && !jumpedUnread) {
        anchor.scrollIntoView({ block: "center" });
        jumpedUnread = true;
        return;
      }
      scroller.scrollTop = scroller.scrollHeight;
    });
  });

  const sendDraft = () => {
    void postDraft(session(), draft(), file())
      .then(() => {
        setDraft("");
        setFile(null);
        setSendError(null);
      })
      .catch((error: unknown) => {
        setSendError(failText(error, "Could not send that message"));
      });
  };

  const pickFiles = (list: FileList | null) => {
    void packAttachments(list)
      .then(setFile)
      .catch((error: unknown) => {
        setSendError(failText(error, "Could not pack that folder"));
      });
  };

  const shownRoom = () => liveRoom() ?? room();

  return (
    <ConversationPane
      room={shownRoom()}
      status={status()}
      callLabel={callCountLabel(inCall(), othersInCall().length)}
      inCall={inCall()}
      callFull={callFull()}
      showStage={inCall() || othersInCall().length > 0}
      callError={callError()}
      roomError={roomError()}
      selfId={profile()?.id}
      localStream={localStream()}
      remoteStreams={remoteStreams()}
      roster={callRoster()}
      names={authors().names}
      avatars={authors().avatars}
      messages={messages()}
      typing={typing()}
      draft={draft()}
      file={file()}
      sendError={sendError()}
      muted={muted()}
      cameraOn={cameraOn()}
      session={session()}
      search={search()}
      unreadSince={unreadSince()}
      editingId={editingId()}
      editDraft={editDraft()}
      topicDraft={topicDraft()}
      inviteName={inviteName()}
      setScroller={(node) => {
        scroller = node;
      }}
      onJoin={() => {
        setMuted(false);
        void session()?.joinCall();
      }}
      onMute={() => {
        setMuted((value) => {
          const next = !value;
          session()?.setMuted(next);
          return next;
        });
      }}
      onCamera={() => {
        const next = !cameraOn();
        setCameraOn(next);
        void session()?.setCamera(next);
      }}
      onLeave={() => {
        setMuted(false);
        setCameraOn(true);
        void session()?.leaveCall();
      }}
      onDraft={setDraft}
      onSend={sendDraft}
      onPick={pickFiles}
      onRemoveFile={() => setFile(null)}
      onSearch={setSearch}
      onChannelMute={() => {
        const current = shownRoom();
        if (!current) {
          return;
        }
        void muteRoom(current.id, !current.muted).then((result) => {
          if (result.ok) {
            setLiveRoom(result.data);
            window.dispatchEvent(new Event("chat-refine:activity"));
          }
        });
      }}
      onTopicDraft={setTopicDraft}
      onSaveTopic={() => {
        const current = shownRoom();
        if (!current || current.kind !== "group") {
          return;
        }
        if (topicDraft() === current.topic) {
          return;
        }
        void patchRoomTopic(current.id, topicDraft()).then((result) => {
          if (result.ok) {
            setLiveRoom(result.data);
            setTopicDraft(result.data.topic);
          }
        });
      }}
      onInviteName={setInviteName}
      onInvite={() => {
        const current = shownRoom();
        const username = inviteName().trim();
        if (!current || !username) {
          return;
        }
        void inviteToRoom(current.id, { username }).then((result) => {
          if (result.ok) {
            setLiveRoom(result.data);
            setInviteName("");
            window.dispatchEvent(new Event("chat-refine:activity"));
          } else {
            setSendError("Could not invite that person.");
          }
        });
      }}
      onStartEdit={(item) => {
        setEditingId(item.clientMessageId);
        setEditDraft(item.body);
      }}
      onEditDraft={setEditDraft}
      onSaveEdit={(body) => {
        const id = editingId();
        if (!id || !body.trim()) {
          return;
        }
        void session()
          ?.editMessage(id, body)
          .then(() => {
            setEditingId(null);
            setEditDraft("");
          })
          .catch((error: unknown) => {
            setSendError(failText(error, "Could not edit that message"));
          });
      }}
      onCancelEdit={() => {
        setEditingId(null);
        setEditDraft("");
      }}
      onDelete={(item) => {
        void session()
          ?.deleteMessage(item.clientMessageId)
          .catch((error: unknown) => {
            setSendError(failText(error, "Could not delete that message"));
          });
      }}
    />
  );
};
