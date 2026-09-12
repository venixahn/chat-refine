import { createEffect } from "solid-js";

export const MediaTile = (props: {
  label: string;
  stream: MediaStream | null;
  muted?: boolean;
}) => {
  let video: HTMLVideoElement | undefined;

  createEffect(() => {
    if (video) {
      video.srcObject = props.stream;
    }
  });

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
    </figure>
  );
};
