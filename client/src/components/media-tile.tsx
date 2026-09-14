import { Show, createEffect } from "solid-js";
import { bindSrcObject } from "../lib/media-el.ts";

export const MediaTile = (props: {
  label: string;
  stream: MediaStream | null;
  muted?: boolean;
  audio?: boolean;
  video?: boolean;
}) => {
  let video: HTMLVideoElement | undefined;
  let speaker: HTMLAudioElement | undefined;

  createEffect(() => {
    bindSrcObject(video, props.stream);
    bindSrcObject(speaker, props.muted ? null : props.stream);
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
          bindSrcObject(el, props.stream);
        }}
        autoplay
        playsinline
        muted
        aria-label={props.label}
        class="aspect-video w-full bg-black object-cover"
      />
      <Show when={!props.muted}>
        <audio
          ref={(el) => {
            speaker = el;
            bindSrcObject(el, props.stream);
          }}
          autoplay
          class="hidden"
        />
      </Show>
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
