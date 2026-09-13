import { Show, createEffect } from "solid-js";

export const MediaTile = (props: {
  label: string;
  stream: MediaStream | null;
  muted?: boolean;
  audio?: boolean;
  video?: boolean;
}) => {
  let video: HTMLVideoElement | undefined;

  createEffect(() => {
    if (video) {
      video.srcObject = props.stream;
    }
  });

  const badge = () => {
    const parts: string[] = [];
    if (props.audio === false) {
      parts.push("muted");
    }
    if (props.video === false) {
      parts.push("cam off");
    }
    return parts.join(" · ");
  };

  return (
    <figure class="relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <video
        ref={(el) => {
          video = el;
          el.srcObject = props.stream;
        }}
        autoplay
        playsinline
        muted={props.muted}
        aria-label={props.label}
        class="aspect-video w-full bg-black object-cover"
      />
      <figcaption class="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs">
        {props.label}
      </figcaption>
      <Show when={badge()}>
        {(text) => (
          <p class="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-[var(--muted)]">
            {text()}
          </p>
        )}
      </Show>
    </figure>
  );
};
