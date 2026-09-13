import { For, Show } from "solid-js";
import type { CallPresence } from "@chat-refine/shared";
import { callCountLabel, joinCallLabel } from "../lib/call-labels.ts";
import type { RemoteMedia } from "../lib/chat-session.ts";
import { MediaTile } from "./media-tile.tsx";

export { callCountLabel, joinCallLabel };

export const CallStage = (props: {
  selfId?: string;
  localStream: MediaStream | null;
  remoteStreams: RemoteMedia[];
  roster: CallPresence[];
  names: Map<string, string>;
}) => {
  const others = () =>
    props.roster.filter((item) => item.userId !== props.selfId);
  const remoteOf = (userId: string) =>
    props.remoteStreams.find((item) => item.userId === userId)?.stream ?? null;
  const columns = () =>
    others().length + (props.localStream ? 1 : 0) > 4
      ? "md:grid-cols-3"
      : "md:grid-cols-2";

  return (
    <section
      class={`grid grid-cols-1 gap-3 border-b border-[var(--line)] px-6 py-4 ${columns()}`}
    >
      <Show when={props.localStream}>
        {(stream) => <MediaTile label="You" stream={stream()} muted />}
      </Show>
      <For each={others()}>
        {(item) => (
          <MediaTile
            label={props.names.get(item.userId) ?? "Peer"}
            stream={remoteOf(item.userId)}
            audio={item.audio}
            video={item.video}
          />
        )}
      </For>
    </section>
  );
};
