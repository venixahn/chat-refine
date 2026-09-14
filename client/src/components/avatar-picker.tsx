import { AVATAR_IDS, avatarPath } from "@chat-refine/shared";
import { For } from "solid-js";

export const AvatarPicker = (props: {
  selected: string | null | undefined;
  onSelect: (url: string) => void;
  onUpload: (file: File) => void;
}) => (
  <div class="flex flex-col gap-2">
    <p class="text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
      Avatars
    </p>
    <div class="grid max-h-40 grid-cols-6 gap-2 overflow-y-auto">
      <For each={[...AVATAR_IDS]}>
        {(id) => {
          const url = avatarPath(id);
          return (
            <button
              type="button"
              aria-label={`Avatar ${id}`}
              class={`rounded-full ring-2 ${
                props.selected === url
                  ? "ring-[var(--accent)]"
                  : "ring-transparent"
              }`}
              onClick={() => props.onSelect(url)}
            >
              <img src={url} alt="" class="h-9 w-9 rounded-full" />
            </button>
          );
        }}
      </For>
    </div>
    <label class="text-xs text-[var(--muted)]">
      Or upload your own
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Upload avatar"
        class="mt-2 block w-full text-sm normal-case"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) {
            props.onUpload(file);
          }
          event.currentTarget.value = "";
        }}
      />
    </label>
  </div>
);
