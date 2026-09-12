import { Inject, Injectable } from "@nestjs/common";
import { PassportSerializer } from "@nestjs/passport";
import type { PublicProfile } from "../db/schema.ts";
import { AuthService } from "./auth.service.ts";

@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {
    super();
  }

  serializeUser(
    user: PublicProfile,
    done: (error: Error | null, id?: string) => void,
  ): void {
    done(null, user.id);
  }

  deserializeUser(
    id: string,
    done: (error: Error | null, user?: PublicProfile | false) => void,
  ): void {
    const user = this.auth.publicById(id);
    done(null, user ?? false);
  }
}
