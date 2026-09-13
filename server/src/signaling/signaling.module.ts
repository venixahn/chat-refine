import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.ts";
import { RoomsModule } from "../rooms/rooms.module.ts";
import { IceController } from "./ice.controller.ts";
import { SignalController } from "./signal.controller.ts";
import { SignalTicketService } from "./signal-ticket.service.ts";
import { CallRosterService } from "./call-roster.service.ts";
import { SfuService } from "./sfu.service.ts";
import { SignalingGateway } from "./signaling.gateway.ts";
import { SignalingHub } from "./signaling.hub.ts";

@Module({
  imports: [AuthModule, RoomsModule],
  controllers: [SignalController, IceController],
  providers: [
    SignalTicketService,
    SignalingHub,
    SignalingGateway,
    CallRosterService,
    SfuService,
  ],
})
export class SignalingModule {}
