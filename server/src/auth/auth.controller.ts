import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Inject,
  InternalServerErrorException,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Effect } from "effect";
import type { Request } from "express";
import {
  signupSchema,
  updateProfileSchema,
  type SignupInput,
  type UpdateProfileInput,
} from "@chat-refine/shared";
import type { PublicProfile } from "../db/schema.ts";
import { ZodValidationPipe } from "../http/zod-validation.pipe.ts";
import { AuthService } from "./auth.service.ts";
import { LocalAuthGuard } from "./local-auth.guard.ts";
import { SessionAuthGuard } from "./session.guard.ts";

const loginUser = (request: Request, user: PublicProfile): Promise<void> =>
  new Promise((resolve, reject) => {
    request.login(user, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("signup")
  async signup(
    @Body(new ZodValidationPipe(signupSchema)) body: SignupInput,
    @Req() request: Request,
  ): Promise<PublicProfile> {
    const result = await Effect.runPromise(Effect.either(this.auth.signup(body)));
    if (result._tag === "Left") {
      if (result.left._tag === "UsernameTaken") {
        throw new ConflictException("Username already taken");
      }
      throw new InternalServerErrorException();
    }
    await loginUser(request, result.right);
    return result.right;
  }

  @UseGuards(LocalAuthGuard)
  @HttpCode(200)
  @Post("login")
  login(@Req() request: Request): PublicProfile {
    return request.user as PublicProfile;
  }

  @UseGuards(SessionAuthGuard)
  @Get("me")
  me(@Req() request: Request): PublicProfile {
    return request.user as PublicProfile;
  }

  @UseGuards(SessionAuthGuard)
  @Patch("me")
  async updateMe(
    @Req() request: Request,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ): Promise<PublicProfile> {
    const user = request.user as PublicProfile;
    const result = await Effect.runPromise(
      Effect.either(this.auth.updateProfile(user.id, body)),
    );
    if (result._tag === "Left") {
      throw new InternalServerErrorException();
    }
    return result.right;
  }

  @HttpCode(200)
  @Post("logout")
  logout(@Req() request: Request): Promise<{ ok: true }> {
    return new Promise((resolve, reject) => {
      request.logout((error) => {
        if (error) {
          reject(error);
          return;
        }
        request.session.destroy((destroyError) => {
          if (destroyError) {
            reject(destroyError);
            return;
          }
          resolve({ ok: true });
        });
      });
    });
  }
}
