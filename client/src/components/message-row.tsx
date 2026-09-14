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
}) => (
  <li
    class={`flex gap-3 px-1 ${props.grouped ? "pt-0.5" : "pt-3"}`}
  >
    <div class="w-8 shrink-0">
      <Show when={!props.grouped}>
        <Avatar name={props.name} src={props.avatarUrl} />
      </Show>
    </div>
    <div class="min-w-0 flex-1">
      <Show when={!props.grouped}>
        <div class="flex flex-wrap items-baseline gap-2">
          <span class="text-sm font-semibold">{props.name}</span>
          <time
            class="text-xs text-[var(--muted)]"
            datetime={props.item.createdAt}
          >
            {formatClock(props.item.createdAt)}
          </time>
        </div>
      </Show>
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
    </div>
  </li>
);
