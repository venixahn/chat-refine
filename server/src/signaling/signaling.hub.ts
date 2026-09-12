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

  forSession(userId: string, joined: () => ReadonlySet<string>) {
    return this.frames$.pipe(
      filter((envelope) => joined().has(envelope.conversationId)),
      filter((envelope) => !envelope.toUserId || envelope.toUserId === userId),
      filter((envelope) => envelope.exceptUserId !== userId),
    );
  }
}
