import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";

export type IssuedTicket = {
  ticket: string;
  expiresAt: string;
};

type TicketRecord = {
  userId: string;
  expiresAt: number;
};

@Injectable()
export class SignalTicketService {
  private readonly tickets = new Map<string, TicketRecord>();
  private readonly ttlMs: number;

  constructor() {
    this.ttlMs = Number(process.env.SIGNAL_TICKET_TTL_MS ?? 120_000);
  }

  issue(userId: string): IssuedTicket {
    this.gc();
    const ticket = randomUUID();
    const expiresAt = Date.now() + this.ttlMs;
    this.tickets.set(ticket, { userId, expiresAt });
    return { ticket, expiresAt: new Date(expiresAt).toISOString() };
  }

  resolve(ticket: string): string | undefined {
    this.gc();
    const record = this.tickets.get(ticket);
    if (!record) {
      return undefined;
    }
    if (record.expiresAt <= Date.now()) {
      this.tickets.delete(ticket);
      return undefined;
    }
    return record.userId;
  }

  private gc(): void {
    const now = Date.now();
    for (const [key, record] of this.tickets) {
      if (record.expiresAt <= now) {
        this.tickets.delete(key);
      }
    }
  }
}
