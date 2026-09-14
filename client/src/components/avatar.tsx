import { Show } from "solid-js";
import { initialsOf } from "../lib/thread-ui.ts";

export const Avatar = (props: {
  name: string;
  src?: string | null;
  size?: "sm" | "md";
}) => {
  const box = () =>
    props.size === "md" ? "h-9 w-9 text-sm" : "h-8 w-8 text-xs";
  return (
    <Show
      when={props.src}
      fallback={
        <span
          class={`inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--line)] font-medium ${box()}`}
        >
          {initialsOf(props.name)}
        </span>
      }
    >
      {(url) => (
        <img
          src={url()}
          alt=""
          class={`shrink-0 rounded-full object-cover ${box()}`}
        />
      )}
    </Show>
  );
};
