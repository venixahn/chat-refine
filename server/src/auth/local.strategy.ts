import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Effect } from "effect";
import { Strategy } from "passport-local";
import { loginSchema } from "@chat-refine/shared";
import type { PublicProfile } from "../db/schema.ts";
import { AuthService } from "./auth.service.ts";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {
    super();
  }

  async validate(username: string, password: string): Promise<PublicProfile> {
    const parsed = loginSchema.safeParse({ username, password });
    if (!parsed.success) {
      throw new UnauthorizedException();
    }
    const result = await Effect.runPromise(
      Effect.either(this.auth.verify(parsed.data)),
    );
    if (result._tag === "Left") {
      throw new UnauthorizedException();
    }
    return result.right;
  }
}
