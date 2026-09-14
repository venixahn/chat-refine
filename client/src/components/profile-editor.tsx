import type { UserPreferences } from "@chat-refine/shared";
import { Show, type JSX } from "solid-js";
import { AvatarPicker } from "./avatar-picker.tsx";

export const ProfileEditor = (props: {
  displayName: string;
  bio: string;
  status: string;
  theme: UserPreferences["theme"];
  visibility: UserPreferences["visibility"];
  showOnline: boolean;
  avatarUrl: string | null | undefined;
  error: string | null;
  onDisplayName: (value: string) => void;
  onBio: (value: string) => void;
  onStatus: (value: string) => void;
  onTheme: (value: UserPreferences["theme"]) => void;
  onVisibility: (value: UserPreferences["visibility"]) => void;
  onShowOnline: (value: boolean) => void;
  onAvatar: (url: string) => void;
  onUpload: (file: File) => void;
  onSave: () => void;
  onCancel: () => void;
}) => {
  const onSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (event) => {
    event.preventDefault();
    props.onSave();
  };
  return (
    <form class="mt-2 flex flex-col gap-2" onSubmit={onSubmit}>
      <label class="text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
        Display name
        <input
          value={props.displayName}
          onInput={(event) => props.onDisplayName(event.currentTarget.value)}
          class="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--text)]"
        />
      </label>
      <label class="text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
        Status
        <input
          value={props.status}
          onInput={(event) => props.onStatus(event.currentTarget.value)}
          class="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--text)]"
        />
      </label>
      <label class="text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
        Bio
        <textarea
          value={props.bio}
          rows={2}
          onInput={(event) => props.onBio(event.currentTarget.value)}
          class="mt-2 w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--text)]"
        />
      </label>
      <AvatarPicker
        selected={props.avatarUrl}
        onSelect={props.onAvatar}
        onUpload={props.onUpload}
      />
      <label class="text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
        Theme
        <select
          aria-label="Theme"
          value={props.theme}
          onChange={(event) =>
            props.onTheme(
              event.currentTarget.value as UserPreferences["theme"],
            )
          }
          class="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--text)]"
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="system">System</option>
        </select>
      </label>
      <label class="text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
        Visibility
        <select
          aria-label="Visibility"
          value={props.visibility}
          onChange={(event) =>
            props.onVisibility(
              event.currentTarget.value as UserPreferences["visibility"],
            )
          }
          class="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--text)]"
        >
          <option value="everyone">Everyone can find me</option>
          <option value="contacts">Contacts only</option>
          <option value="hidden">Hidden from search</option>
        </select>
      </label>
      <label class="flex items-center gap-2 text-sm text-[var(--muted)]">
        <input
          type="checkbox"
          checked={props.showOnline}
          onChange={(event) => props.onShowOnline(event.currentTarget.checked)}
        />
        Show when I am online
      </label>
      <Show when={props.error}>
        <p class="text-sm text-red-300">{props.error}</p>
      </Show>
      <div class="flex gap-2">
        <button
          type="submit"
          class="rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm text-[var(--bg)]"
        >
          Save
        </button>
        <button
          type="button"
          class="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm"
          onClick={() => props.onCancel()}
        >
          Cancel
        </button>
      </div>
    </form>
  );
};
