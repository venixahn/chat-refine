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
import { getRoom } from "../lib/rooms-api.ts";

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
    for (const member of room()?.members ?? []) {
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

  createEffect(() => {
    messages();
    queueMicrotask(() => {
      if (scroller) {
        scroller.scrollTop = scroller.scrollHeight;
      }
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

  return (
    <ConversationPane
      room={room()}
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
    />
  );
};
