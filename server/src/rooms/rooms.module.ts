import { Module } from "@nestjs/common";
import { FileStore } from "../files/file-store.ts";
import { MessagesController } from "./messages.controller.ts";
import { MessagesService } from "./messages.service.ts";
import { RoomsController } from "./rooms.controller.ts";
import { RoomsService } from "./rooms.service.ts";
import { UsersController } from "./users.controller.ts";

@Module({
  controllers: [RoomsController, UsersController, MessagesController],
  providers: [RoomsService, MessagesService, FileStore],
  exports: [RoomsService],
})
export class RoomsModule {}
