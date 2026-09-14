import { For, Show } from "solid-js";
import type { PresencePerson } from "../lib/thread-ui.ts";
import { Avatar } from "./avatar.tsx";

export const MemberStrip = (props: { people: PresencePerson[] }) => (
  <Show when={props.people.length > 0}>
    <ul aria-label="Members" class="mt-2 flex flex-wrap items-center gap-1">
      <For each={props.people}>
        {(person) => (
          <li>
            <span
              class={person.here ? "" : "opacity-40"}
              title={person.name}
              aria-label={person.here ? `${person.name} here` : person.name}
            >
              <Avatar name={person.name} src={person.avatarUrl} size="xs" />
            </span>
          </li>
        )}
      </For>
      <li
        class="pl-1 text-xs text-[var(--muted)]"
        aria-label={`${props.people.length} members`}
      >
        {props.people.length}
      </li>
    </ul>
  </Show>
);
