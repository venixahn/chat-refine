import { Injectable } from "@nestjs/common";
import type { SignalingEvent } from "@chat-refine/shared";
import { Subject } from "rxjs";
import { filter } from "rxjs/operators";

export type HubEnvelope = {
  conversationId: string;
  toUserId?: string;
  exceptUserId?: string;
  event: SignalingEvent;
};

@Injectable()
export class SignalingHub {
  readonly frames$ = new Subject<HubEnvelope>();

  publish(envelope: HubEnvelope): void {
    this.frames$.next(envelope);
  }

  forSession(
    userId: string,
    joined: () => ReadonlySet<string>,
    inbox: (conversationId: string) => boolean = () => false,
  ) {
    return this.frames$.pipe(
      filter((envelope) =>
        this.visibleTo(envelope, userId, joined, inbox),
      ),
    );
  }

  private visibleTo(
    envelope: HubEnvelope,
    userId: string,
    joined: () => ReadonlySet<string>,
    inbox: (conversationId: string) => boolean,
  ): boolean {
    if (envelope.toUserId && envelope.toUserId !== userId) {
      return false;
    }
    if (envelope.exceptUserId === userId) {
      return false;
    }
    if (envelope.event.type === "activity") {
      return inbox(envelope.conversationId);
    }
    return joined().has(envelope.conversationId);
  }
}
