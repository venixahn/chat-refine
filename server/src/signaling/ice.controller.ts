import { Controller, Get, UseGuards } from "@nestjs/common";
import { parseIceServers, type IceServer } from "@chat-refine/shared";
import { SessionAuthGuard } from "../auth/session.guard.ts";

@Controller("ice")
export class IceController {
  @UseGuards(SessionAuthGuard)
  @Get()
  list(): { iceServers: IceServer[] } {
    return { iceServers: parseIceServers(process.env.ICE_SERVERS) };
  }
}
