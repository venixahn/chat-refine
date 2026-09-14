import { Show } from "solid-js";
import type { ChatMessage } from "@chat-refine/shared";
import { messageFileUrl } from "../lib/rooms-api.ts";
import { formatClock } from "../lib/thread-ui.ts";
import { Avatar } from "./avatar.tsx";
import { Markdown } from "./markdown.tsx";

const isImage = (mime: string) => mime.startsWith("image/");

export const MessageRow = (props: {
  item: ChatMessage;
  name: string;
  avatarUrl?: string | null;
  grouped: boolean;
  mine: boolean;
  unreadStart: boolean;
  hit: boolean;
  editing: boolean;
  editDraft: string;
  onEditDraft: (value: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}) => (
  <li
    data-unread={props.unreadStart ? "true" : undefined}
    class={`group flex gap-3 px-1 ${props.grouped ? "pt-0.5" : "pt-3"} ${
      props.hit ? "rounded-md bg-[var(--surface)]" : ""
    }`}
  >
    <div class="w-8 shrink-0">
      <Show when={!props.grouped}>
        <Avatar name={props.name} src={props.avatarUrl} />
      </Show>
    </div>
    <div class="min-w-0 flex-1">
      <Show when={props.unreadStart}>
        <p class="mb-2 border-t border-[var(--accent)] pt-2 text-xs font-semibold text-[var(--accent)]">
          New messages
        </p>
      </Show>
      <Show when={!props.grouped}>
        <div class="flex flex-wrap items-baseline gap-2">
          <span class="text-sm font-semibold">{props.name}</span>
          <time
            class="text-xs text-[var(--muted)]"
            datetime={props.item.createdAt}
          >
            {formatClock(props.item.createdAt)}
          </time>
          <Show when={props.item.editedAt && !props.item.deletedAt}>
            <span class="text-xs text-[var(--muted)]">(edited)</span>
          </Show>
        </div>
      </Show>
      <Show
        when={props.editing}
        fallback={
          <Show
            when={!props.item.deletedAt}
            fallback={
              <p class="text-sm italic text-[var(--muted)]">
                This message was deleted
              </p>
            }
          >
            <Show when={props.item.body.trim().length > 0}>
              <Markdown source={props.item.body} />
            </Show>
            <Show when={props.item.attachment}>
              {(attached) => (
                <Show
                  when={isImage(attached().mime)}
                  fallback={
                    <a
                      href={messageFileUrl(
                        props.item.conversationId,
                        props.item.clientMessageId,
                      )}
                      class="mt-1 inline-block text-sm text-[var(--accent)]"
                    >
                      {attached().name}
                    </a>
                  }
                >
                  <img
                    src={messageFileUrl(
                      props.item.conversationId,
                      props.item.clientMessageId,
                    )}
                    alt={attached().name}
                    class="mt-2 max-h-64 rounded-lg"
                  />
                </Show>
              )}
            </Show>
          </Show>
        }
      >
        <textarea
          aria-label="Edit message"
          value={props.editDraft}
          rows={2}
          class="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-sm"
          onInput={(event) => props.onEditDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              props.onSaveEdit();
            }
            if (event.key === "Escape") {
              props.onCancelEdit();
            }
          }}
        />
        <div class="mt-1 flex gap-2 text-xs">
          <button
            type="button"
            class="text-[var(--accent)]"
            onClick={() => props.onSaveEdit()}
          >
            Save
          </button>
          <button
            type="button"
            class="text-[var(--muted)]"
            onClick={() => props.onCancelEdit()}
          >
            Cancel
          </button>
        </div>
      </Show>
      <Show when={props.mine && !props.item.deletedAt && !props.editing}>
        <div class="mt-0.5 flex gap-2 text-xs text-[var(--muted)]">
          <button type="button" onClick={() => props.onStartEdit()}>
            Edit
          </button>
          <button type="button" onClick={() => props.onDelete()}>
            Delete
          </button>
        </div>
      </Show>
    </div>
  </li>
);
