import type { SignalingEvent } from "@chat-refine/shared";
import { filter } from "rxjs";
import { signalTicket } from "./rooms-api.ts";
import { connectSignal } from "./signal-client.ts";

export type InboxHandle = {
  close: () => void;
};

type Activity = Extract<SignalingEvent, { type: "activity" }>;

const isActivity = (event: SignalingEvent): event is Activity =>
  event.type === "activity";

export const startInbox = async (input: {
  onActivity: (event: Activity) => void;
}): Promise<InboxHandle> => {
  const ticket = await signalTicket();
  if (!ticket.ok) {
    throw new Error("Inbox ticket failed");
  }
  const signal = connectSignal(ticket.data.ticket);
  await signal.ready;
  const subscription = signal.events$
    .pipe(filter(isActivity))
    .subscribe(input.onActivity);
  return {
    close: () => {
      subscription.unsubscribe();
      signal.close();
    },
  };
};
