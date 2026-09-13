import { A, useParams } from "@solidjs/router";
import {
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";
import type { CallPresence, ChatMessage } from "@chat-refine/shared";
import { Markdown } from "../components/markdown.tsx";
import { MediaTile } from "../components/media-tile.tsx";
import { me } from "../lib/auth-api.ts";
import {
  startChatSession,
  type ChatSession,
  type RemoteMedia,
} from "../lib/chat-session.ts";
import { readFilePayload } from "../lib/file.ts";
import { getRoom, messageFileUrl } from "../lib/rooms-api.ts";

const isImage = (mime: string) => mime.startsWith("image/");

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
      if (!result.ok) {
        setRoomError("You cannot open this room.");
        return null;
      }
      setRoomError(null);
      return result.data;
    },
  );

  const authors = createMemo(() => {
    const map = new Map<string, string>();
    for (const member of room()?.members ?? []) {
      map.set(member.id, member.displayName);
    }
    const self = profile();
    if (self) {
      map.set(self.id, self.displayName);
    }
    return map;
  });

  const inCall = () => localStream() !== null;
  const showStage = () => inCall() || callRoster().length > 0 || remoteStreams().length > 0;

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
    })
      .then((started) => {
        if (cancelled) {
          started.close();
          return;
        }
        active = started;
        setSession(started);
      })
      .catch(() => {
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

  const sendDraft = async () => {
    const pending = file();
    setSendError(null);
    try {
      const attachment = pending ? await readFilePayload(pending) : undefined;
      await session()?.send({ body: draft(), attachment });
      setDraft("");
      setFile(null);
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : "Could not send that message",
      );
    }
  };

  return (
    <main class="flex h-screen flex-col">
      <header class="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <A
            href="/app"
            class="mb-2 inline-block text-sm text-[var(--accent)] md:hidden"
          >
            Rooms
          </A>
          <h2 class="text-xl font-semibold">{room()?.title ?? "Conversation"}</h2>
          <p class="text-sm text-[var(--muted)]">{status()}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Show
            when={inCall()}
            fallback={
              <button
                type="button"
                class="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--bg)]"
                onClick={() => void session()?.joinCall()}
              >
                Join call
              </button>
            }
          >
            <button
              type="button"
              class="rounded-full border border-[var(--line)] px-4 py-1.5 text-sm"
              onClick={() => {
                setMuted((value) => {
                  const next = !value;
                  session()?.setMuted(next);
                  return next;
                });
              }}
            >
              {muted() ? "Unmute" : "Mute"}
            </button>
            <button
              type="button"
              class="rounded-full border border-[var(--line)] px-4 py-1.5 text-sm"
              onClick={() => {
                const next = !cameraOn();
                setCameraOn(next);
                void session()?.setCamera(next);
              }}
            >
              {cameraOn() ? "Camera off" : "Camera on"}
            </button>
            <button
              type="button"
              class="rounded-full border border-red-400/40 px-4 py-1.5 text-sm text-red-300"
              onClick={() => {
                setMuted(false);
                setCameraOn(true);
                void session()?.leaveCall();
              }}
            >
              Leave call
            </button>
          </Show>
        </div>
      </header>
      <Show when={callError()}>
        <p class="px-6 py-2 text-sm text-red-300">{callError()}</p>
      </Show>
      <Show when={showStage()}>
        <section class="grid grid-cols-1 gap-3 border-b border-[var(--line)] px-6 py-4 md:grid-cols-2">
          <Show when={localStream()}>
            {(stream) => <MediaTile label="You" stream={stream()} muted />}
          </Show>
          <For each={remoteStreams()}>
            {(item) => (
              <MediaTile
                label={authors().get(item.userId) ?? "Peer"}
                stream={item.stream}
              />
            )}
          </For>
        </section>
      </Show>
      <Show when={roomError()}>
        <p class="px-6 py-4 text-red-300">{roomError()}</p>
      </Show>
      <ol class="flex-1 space-y-3 overflow-y-auto px-6 py-5">
        <For
          each={messages()}
          fallback={
            <li class="text-sm text-[var(--muted)]">
              No messages yet. History is stored on this server; live text also
              travels over a WebRTC data channel.
            </li>
          }
        >
          {(item) => (
            <li class="max-w-xl rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <p class="text-xs text-[var(--muted)]">
                {authors().get(item.fromUserId) ?? "Peer"}
              </p>
              <Show when={item.body.trim().length > 0}>
                <Markdown source={item.body} />
              </Show>
              <Show when={item.attachment}>
                {(attached) => (
                  <Show
                    when={isImage(attached().mime)}
                    fallback={
                      <a
                        href={messageFileUrl(
                          item.conversationId,
                          item.clientMessageId,
                        )}
                        class="mt-2 inline-block text-sm text-[var(--accent)]"
                      >
                        {attached().name}
                      </a>
                    }
                  >
                    <img
                      src={messageFileUrl(
                        item.conversationId,
                        item.clientMessageId,
                      )}
                      alt={attached().name}
                      class="mt-2 max-h-64 rounded-lg"
                    />
                  </Show>
                )}
              </Show>
            </li>
          )}
        </For>
      </ol>
      <Show when={typing().length > 0}>
        <p class="px-6 text-sm text-[var(--accent)]">
          {typing().join(", ")} typing…
        </p>
      </Show>
      <form
        class="border-t border-[var(--line)] px-6 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          void sendDraft();
        }}
      >
        <Show when={file()}>
          {(picked) => (
            <p class="mb-2 text-sm text-[var(--muted)]">
              Attached {picked().name}{" "}
              <button
                type="button"
                class="text-[var(--accent)]"
                onClick={() => setFile(null)}
              >
                Remove
              </button>
            </p>
          )}
        </Show>
        <Show when={sendError()}>
          <p class="mb-2 text-sm text-red-300">{sendError()}</p>
        </Show>
        <div class="flex gap-3">
          <textarea
            aria-label="Message"
            value={draft()}
            rows={2}
            onInput={(event) => {
              setDraft(event.currentTarget.value);
              session()?.notifyTyping();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendDraft();
              }
            }}
            class="min-h-[3rem] flex-1 resize-none rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
          />
          <label class="self-end rounded-full border border-[var(--line)] px-4 py-2 text-sm">
            Attach
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain"
              aria-label="Attach file"
              class="sr-only"
              onChange={(event) => {
                setFile(event.currentTarget.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <button
            type="submit"
            class="self-end rounded-full bg-[var(--accent)] px-5 py-2 font-medium text-[var(--bg)]"
          >
            Send
          </button>
        </div>
      </form>
    </main>
  );
};
