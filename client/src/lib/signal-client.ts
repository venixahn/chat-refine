import {
  signalingEventSchema,
  type SignalingEvent,
  type SignalingFrame,
} from "@chat-refine/shared";
import { Subject } from "rxjs";

export type SignalClient = {
  events$: Subject<SignalingEvent>;
  ready: Promise<void>;
  send: (frame: SignalingFrame) => void;
  close: () => void;
};

export const connectSignal = (ticket: string): SignalClient => {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(
    `${protocol}//${location.host}/ws?ticket=${encodeURIComponent(ticket)}`,
  );
  const events$ = new Subject<SignalingEvent>();
  const ready = new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve());
    socket.addEventListener("error", () =>
      reject(new Error("Signaling socket failed")),
    );
    socket.addEventListener("close", (event) => {
      if (event.code === 4401) {
        reject(new Error("Signaling ticket rejected"));
      }
    });
  });
  socket.addEventListener("message", (event) => {
    try {
      const parsed = signalingEventSchema.safeParse(JSON.parse(String(event.data)));
      if (parsed.success) {
        events$.next(parsed.data);
      }
    } catch {
      // Drop non-JSON frames.
    }
  });
  return {
    events$,
    ready,
    send: (frame) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(frame));
      }
    },
    close: () => {
      events$.complete();
      socket.close();
    },
  };
};
