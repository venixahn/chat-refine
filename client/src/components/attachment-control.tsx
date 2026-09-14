import { Show, createSignal, onCleanup, onMount } from "solid-js";

export const AttachmentControl = (props: {
  onPick: (files: FileList | null) => void;
}) => {
  const [open, setOpen] = createSignal(false);
  let root: HTMLDivElement | undefined;

  onMount(() => {
    const onDocClick = (event: MouseEvent) => {
      if (root && !root.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    onCleanup(() => document.removeEventListener("mousedown", onDocClick));
  });

  const take = (list: FileList | null) => {
    setOpen(false);
    props.onPick(list);
  };

  const markDirectoryPicker = (input: HTMLInputElement | undefined) => {
    if (!input) {
      return;
    }
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
    (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory =
      true;
  };

  return (
    <div
      ref={(node) => {
        root = node;
      }}
      class="relative self-end"
    >
      <button
        type="button"
        class="rounded-full border border-[var(--line)] px-4 py-2 text-sm"
        aria-expanded={open()}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        Attach
      </button>
      <input
        id="attach-files"
        type="file"
        multiple
        aria-label="Attach file"
        class="sr-only"
        onChange={(event) => {
          take(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <input
        id="attach-folder"
        type="file"
        multiple
        aria-label="Attach folder"
        class="sr-only"
        ref={markDirectoryPicker}
        onChange={(event) => {
          take(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <Show when={open()}>
        <div
          role="menu"
          class="absolute right-0 bottom-full z-10 mb-2 flex w-36 flex-col rounded-xl border border-[var(--line)] bg-[var(--surface)] py-1"
        >
          <label
            for="attach-files"
            class="cursor-pointer px-3 py-2 text-sm hover:bg-[var(--bg)]"
          >
            Files
          </label>
          <label
            for="attach-folder"
            class="cursor-pointer px-3 py-2 text-sm hover:bg-[var(--bg)]"
          >
            Folder
          </label>
        </div>
      </Show>
    </div>
  );
};
