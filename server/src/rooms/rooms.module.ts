import { Module } from "@nestjs/common";
import { RoomsController } from "./rooms.controller.ts";
import { RoomsService } from "./rooms.service.ts";
import { UsersController } from "./users.controller.ts";

@Module({
  controllers: [RoomsController, UsersController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
