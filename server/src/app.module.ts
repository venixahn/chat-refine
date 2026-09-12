import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module.ts";
import { DbModule } from "./db/db.module.ts";
import { HealthController } from "./health/health.controller.ts";

@Module({
  imports: [DbModule, AuthModule],
  controllers: [HealthController],
})
export class AppModule {}
