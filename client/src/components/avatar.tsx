import { Show } from "solid-js";
import { initialsOf } from "../lib/thread-ui.ts";

export const Avatar = (props: {
  name: string;
  src?: string | null;
  size?: "xs" | "sm" | "md";
}) => {
  const box = () => {
    if (props.size === "md") {
      return "h-9 w-9 text-sm";
    }
    if (props.size === "xs") {
      return "h-6 w-6 text-[10px]";
    }
    return "h-8 w-8 text-xs";
  };
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
