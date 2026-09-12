import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { PublicProfile } from "../db/schema.ts";
import { SessionAuthGuard } from "../auth/session.guard.ts";
import {
  SignalTicketService,
  type IssuedTicket,
} from "./signal-ticket.service.ts";

@Controller("signal")
export class SignalController {
  constructor(
    @Inject(SignalTicketService) private readonly tickets: SignalTicketService,
  ) {}

  @UseGuards(SessionAuthGuard)
  @Get("ticket")
  ticket(@Req() request: Request): IssuedTicket {
    const user = request.user as PublicProfile;
    return this.tickets.issue(user.id);
  }
}
