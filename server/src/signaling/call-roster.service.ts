import { Injectable } from "@nestjs/common";
import {
  applyCallState,
  canAddAvPeer,
  type CallPresence,
} from "@chat-refine/shared";

export type CallApply = { inCall: boolean; audio: boolean; video: boolean };

export type CallApplyResult =
  | { ok: true; roster: CallPresence[]; changed: boolean }
  | { ok: false; reason: "call-full" };

@Injectable()
export class CallRosterService {
  private readonly rooms = new Map<string, Map<string, CallPresence>>();

  snapshot(conversationId: string): CallPresence[] {
    return [...(this.rooms.get(conversationId)?.values() ?? [])];
  }

  apply(
    conversationId: string,
    userId: string,
    state: CallApply,
  ): CallApplyResult {
    const current = this.rooms.get(conversationId) ?? new Map<string, CallPresence>();
    if (state.inCall && !current.has(userId) && !canAddAvPeer(current.size)) {
      return { ok: false, reason: "call-full" };
    }
    const next = applyCallState([...current.values()], userId, state);
    const changed = this.rosterChanged([...current.values()], next);
    this.write(conversationId, next);
    return { ok: true, roster: next, changed };
  }

  dropUser(
    userId: string,
    conversationIds: readonly string[],
  ): { conversationId: string; roster: CallPresence[] }[] {
    return conversationIds.flatMap((conversationId) => {
      const result = this.apply(conversationId, userId, {
        inCall: false,
        audio: false,
        video: false,
      });
      return result.ok && result.changed
        ? [{ conversationId, roster: result.roster }]
        : [];
    });
  }

  private write(conversationId: string, roster: CallPresence[]): void {
    if (roster.length === 0) {
      this.rooms.delete(conversationId);
      return;
    }
    this.rooms.set(
      conversationId,
      new Map(roster.map((item) => [item.userId, item])),
    );
  }

  private rosterChanged(
    before: readonly CallPresence[],
    after: readonly CallPresence[],
  ): boolean {
    return JSON.stringify(before) !== JSON.stringify(after);
  }
}
