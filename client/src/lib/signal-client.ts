import {
  signalingEventSchema,
  type SignalingEvent,
  type SignalingFrame,
} from "@chat-refine/shared";
import { filter, fromEvent, map, Subject, take } from "rxjs";

export type SignalClient = {
  events$: Subject<SignalingEvent>;
  ready: Promise<void>;
  send: (frame: SignalingFrame) => void;
  close: () => void;
};

const parseFrame = (raw: unknown): SignalingEvent | undefined => {
  try {
    const parsed = signalingEventSchema.safeParse(JSON.parse(String(raw)));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};

export const connectSignal = (ticket: string): SignalClient => {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(
    `${protocol}//${location.host}/ws?ticket=${encodeURIComponent(ticket)}`,
  );
  const events$ = new Subject<SignalingEvent>();
  const ready = new Promise<void>((resolve, reject) => {
    fromEvent(socket, "open").pipe(take(1)).subscribe(() => resolve());
    fromEvent(socket, "error").pipe(take(1)).subscribe(() =>
      reject(new Error("Signaling socket failed")),
    );
    fromEvent<CloseEvent>(socket, "close")
      .pipe(
        take(1),
        filter((event) => event.code === 4401),
      )
      .subscribe(() => reject(new Error("Signaling ticket rejected")));
  });
  fromEvent<MessageEvent>(socket, "message")
    .pipe(
      map((event) => parseFrame(event.data)),
      filter((event): event is SignalingEvent => event !== undefined),
    )
    .subscribe((event) => events$.next(event));
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
