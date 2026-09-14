import { For, Show, type JSX } from "solid-js";
import type { PublicProfile } from "../lib/auth-api.ts";

export const PeopleSearch = (props: {
  query: string;
  error: string | null;
  matches: PublicProfile[];
  onQuery: (value: string) => void;
  onPick: (person: PublicProfile) => void;
  onSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent>;
}) => (
  <form
    class="flex flex-col gap-2"
    onSubmit={(event) => props.onSubmit(event)}
  >
    <label class="text-xs font-semibold text-[var(--muted)]">
      Find people
      <input
        value={props.query}
        onInput={(event) => props.onQuery(event.currentTarget.value)}
        placeholder="Name or username"
        aria-label="Find people"
        class="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1.5 text-sm font-normal text-[var(--text)]"
      />
    </label>
    <Show when={props.query.trim().length > 0}>
      <ul class="max-h-36 overflow-y-auto">
        <For
          each={props.matches}
          fallback={
            <li class="px-1 text-sm text-[var(--muted)]">No matches</li>
          }
        >
          {(person) => (
            <li>
              <button
                type="button"
                class="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[var(--bg)]"
                onClick={() => props.onPick(person)}
              >
                {person.displayName} · @{person.username}
              </button>
            </li>
          )}
        </For>
      </ul>
    </Show>
    <button
      type="submit"
      class="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm"
    >
      Open chat
    </button>
    <Show when={props.error}>
      <p class="text-sm text-red-300">{props.error}</p>
    </Show>
  </form>
);
