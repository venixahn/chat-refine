import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller.ts";
import { AuthService } from "./auth.service.ts";
import { LocalStrategy } from "./local.strategy.ts";
import { SessionSerializer } from "./session.serializer.ts";

@Module({
  imports: [PassportModule.register({ session: true })],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, SessionSerializer],
  exports: [AuthService],
})
export class AuthModule {}
