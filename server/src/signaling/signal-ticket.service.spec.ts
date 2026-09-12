import { afterEach, describe, expect, it } from "vitest";
import { SignalTicketService } from "./signal-ticket.service.ts";

describe("SignalTicketService", () => {
  afterEach(() => {
    delete process.env.SIGNAL_TICKET_TTL_MS;
  });

  it("resolves a fresh ticket to the user id", () => {
    const tickets = new SignalTicketService();
    const issued = tickets.issue("user-1");
    expect(tickets.resolve(issued.ticket)).toBe("user-1");
  });

  it("rejects an unknown or expired ticket", async () => {
    process.env.SIGNAL_TICKET_TTL_MS = "1";
    const tickets = new SignalTicketService();
    expect(tickets.resolve("missing")).toBeUndefined();
    const issued = tickets.issue("user-1");
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(tickets.resolve(issued.ticket)).toBeUndefined();
  });
});
