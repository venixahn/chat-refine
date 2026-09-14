import { A } from "@solidjs/router";
import { For, Show, type JSX } from "solid-js";
import type { CallPresence, ChatMessage } from "@chat-refine/shared";
import { CallStage, joinCallLabel } from "./call-stage.tsx";
import type { ChatSession, RemoteMedia } from "../lib/chat-session.ts";
import { continuesBurst } from "../lib/thread-ui.ts";
import { AttachmentControl } from "./attachment-control.tsx";
import { MessageRow } from "./message-row.tsx";
import type { RoomView } from "../lib/rooms-api.ts";

type PaneProps = {
  room: RoomView | null | undefined;
  status: string;
  callLabel: string;
  inCall: boolean;
  callFull: boolean;
  showStage: boolean;
  callError: string | null;
  roomError: string | null;
  selfId?: string;
  localStream: MediaStream | null;
  remoteStreams: RemoteMedia[];
  roster: CallPresence[];
  names: Map<string, string>;
  avatars: Map<string, string | null>;
  messages: ChatMessage[];
  typing: string[];
  draft: string;
  file: File | null;
  sendError: string | null;
  muted: boolean;
  cameraOn: boolean;
  session: ChatSession | undefined;
  setScroller: (node: HTMLElement) => void;
  onJoin: () => void;
  onMute: () => void;
  onCamera: () => void;
  onLeave: () => void;
  onDraft: (value: string) => void;
  onSend: () => void;
  onPick: (list: FileList | null) => void;
  onRemoveFile: () => void;
};

const startLabel = (room: RoomView | null | undefined): string => {
  const title = room?.title ?? "this conversation";
  return room?.kind === "group" ? `#${title}` : title;
};

const CallControls = (props: {
  inCall: boolean;
  callFull: boolean;
  muted: boolean;
  cameraOn: boolean;
  onJoin: () => void;
  onMute: () => void;
  onCamera: () => void;
  onLeave: () => void;
}) => (
  <div class="flex flex-wrap items-center gap-2">
    <Show
      when={props.inCall}
      fallback={
        <button
          type="button"
          class="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={props.callFull}
          onClick={() => props.onJoin()}
        >
          {joinCallLabel(props.callFull)}
        </button>
      }
    >
      <button
        type="button"
        class="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm"
        onClick={() => props.onMute()}
      >
        {props.muted ? "Unmute" : "Mute"}
      </button>
      <button
        type="button"
        class="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm"
        onClick={() => props.onCamera()}
      >
        {props.cameraOn ? "Camera off" : "Camera on"}
      </button>
      <button
        type="button"
        class="rounded-lg border border-red-400/40 px-3 py-1.5 text-sm text-red-300"
        onClick={() => props.onLeave()}
      >
        Leave call
      </button>
    </Show>
  </div>
);

const ThreadComposer = (props: {
  roomTitle: string;
  draft: string;
  file: File | null;
  sendError: string | null;
  session: ChatSession | undefined;
  onDraft: (value: string) => void;
  onSend: () => void;
  onPick: (list: FileList | null) => void;
  onRemoveFile: () => void;
}) => {
  const onKeyDown: JSX.EventHandler<HTMLTextAreaElement, KeyboardEvent> = (
    event,
  ) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }
    event.preventDefault();
    props.onSend();
  };
  return (
    <form
      class="px-4 pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSend();
      }}
    >
      <Show when={props.file}>
        {(picked) => (
          <p class="mb-2 text-sm text-[var(--muted)]">
            Attached {picked().name}{" "}
            <button
              type="button"
              class="text-[var(--accent)]"
              onClick={() => props.onRemoveFile()}
            >
              Remove
            </button>
          </p>
        )}
      </Show>
      <Show when={props.sendError}>
        <p class="mb-2 text-sm text-red-300">{props.sendError}</p>
      </Show>
      <div class="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
        <textarea
          aria-label="Message"
          placeholder={`Message ${props.roomTitle}`}
          value={props.draft}
          rows={2}
          onInput={(event) => {
            props.onDraft(event.currentTarget.value);
            props.session?.notifyTyping();
          }}
          onKeyDown={onKeyDown}
          class="min-h-[2.75rem] w-full resize-none bg-transparent py-1 outline-none"
        />
        <div class="flex items-center justify-between gap-2 pt-1">
          <AttachmentControl onPick={(list) => props.onPick(list)} />
          <button
            type="submit"
            class="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--bg)]"
          >
            Send
          </button>
        </div>
      </div>
    </form>
  );
};

export const ConversationPane = (props: PaneProps): JSX.Element => (
  <main class="flex h-screen flex-col bg-[var(--bg)]">
    <header class="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-3 sm:px-5 md:flex-row md:items-center md:justify-between">
      <div>
        <A
          href="/app"
          class="mb-2 inline-block text-sm text-[var(--accent)] md:hidden"
        >
          Rooms
        </A>
        <h2 class="text-lg font-bold">
          <Show when={props.room?.kind === "group"}>
            <span aria-hidden class="font-semibold text-[var(--muted)]">
              #
            </span>
          </Show>
          {props.room?.title ?? "Conversation"}
        </h2>
        <p class="text-xs text-[var(--muted)]">
          {props.status}
          <Show when={props.callLabel}>{(label) => ` · ${label()}`}</Show>
        </p>
      </div>
      <CallControls
        inCall={props.inCall}
        callFull={props.callFull}
        muted={props.muted}
        cameraOn={props.cameraOn}
        onJoin={props.onJoin}
        onMute={props.onMute}
        onCamera={props.onCamera}
        onLeave={props.onLeave}
      />
    </header>
    <Show when={props.callError}>
      <p class="px-6 py-2 text-sm text-red-300">{props.callError}</p>
    </Show>
    <Show when={props.showStage}>
      <CallStage
        selfId={props.selfId}
        localStream={props.localStream}
        remoteStreams={props.remoteStreams}
        roster={props.roster}
        names={props.names}
      />
    </Show>
    <Show when={props.roomError}>
      <p class="px-6 py-4 text-red-300">{props.roomError}</p>
    </Show>
    <ol
      ref={props.setScroller}
      class="flex flex-1 flex-col overflow-y-auto px-5 py-4"
    >
      <For
        each={props.messages}
        fallback={
          <li class="m-auto max-w-md text-sm text-[var(--muted)]">
            This is the start of{" "}
            <span class="font-medium text-[var(--text)]">
              {startLabel(props.room)}
            </span>
            . Send a message to get things going.
          </li>
        }
      >
        {(item, index) => (
          <MessageRow
            item={item}
            name={props.names.get(item.fromUserId) ?? "Peer"}
            avatarUrl={props.avatars.get(item.fromUserId)}
            grouped={continuesBurst(props.messages[index() - 1], item)}
          />
        )}
      </For>
    </ol>
    <Show when={props.typing.length > 0}>
      <p class="px-6 pb-1 text-xs text-[var(--muted)]">
        {props.typing.join(", ")} is typing…
      </p>
    </Show>
    <ThreadComposer
      roomTitle={props.room?.title ?? ""}
      draft={props.draft}
      file={props.file}
      sendError={props.sendError}
      session={props.session}
      onDraft={props.onDraft}
      onSend={props.onSend}
      onPick={props.onPick}
      onRemoveFile={props.onRemoveFile}
    />
  </main>
);
