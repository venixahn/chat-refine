import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module.ts";
import { DbModule } from "./db/db.module.ts";
import { HealthController } from "./health/health.controller.ts";
import { RoomsModule } from "./rooms/rooms.module.ts";
import { SignalingModule } from "./signaling/signaling.module.ts";

@Module({
  imports: [DbModule, AuthModule, RoomsModule, SignalingModule],
  controllers: [HealthController],
})
export class AppModule {}
