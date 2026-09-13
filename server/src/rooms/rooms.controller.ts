import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Effect } from "effect";
import type { Request, Response } from "express";
import {
  createGroupSchema,
  openDmSchema,
  type CreateGroupInput,
  type OpenDmInput,
} from "@chat-refine/shared";
import type { PublicProfile } from "../db/schema.ts";
import { ZodValidationPipe } from "../http/zod-validation.pipe.ts";
import { SessionAuthGuard } from "../auth/session.guard.ts";
import { RoomsService, type RoomView } from "./rooms.service.ts";

const viewer = (request: Request): PublicProfile => request.user as PublicProfile;

const throwByTag = (tag: unknown): never => {
  if (tag === "NotAMember") {
    throw new ForbiddenException();
  }
  if (tag === "UserNotFound") {
    throw new NotFoundException("User not found");
  }
  if (tag === "CannotDmSelf") {
    throw new BadRequestException("Cannot message yourself");
  }
  throw new InternalServerErrorException();
};

const throwRoomError = (error: unknown): never => {
  if (typeof error === "object" && error && "_tag" in error) {
    throwByTag(error._tag);
  }
  throw new InternalServerErrorException();
};

const unwrapRoom = async <E>(
  effect: Effect.Effect<RoomView, E | Error>,
): Promise<RoomView> => {
  const result = await Effect.runPromise(Effect.either(effect));
  if (result._tag === "Right") {
    return result.right;
  }
  return throwRoomError(result.left);
};

@Controller("rooms")
@UseGuards(SessionAuthGuard)
export class RoomsController {
  constructor(@Inject(RoomsService) private readonly rooms: RoomsService) {}

  @Get()
  list(@Req() request: Request): RoomView[] {
    return this.rooms.listFor(viewer(request).id);
  }

  @Get("directory")
  directory(@Req() request: Request) {
    return this.rooms.listDirectory(viewer(request).id);
  }

  @Get(":id")
  getOne(
    @Req() request: Request,
    @Param("id") id: string,
  ): Promise<RoomView> {
    return unwrapRoom(this.rooms.getIfMember(viewer(request).id, id));
  }

  @Post()
  create(
    @Req() request: Request,
    @Body(new ZodValidationPipe(createGroupSchema)) body: CreateGroupInput,
  ): Promise<RoomView> {
    return unwrapRoom(this.rooms.createGroup(viewer(request).id, body));
  }

  @Post("dm")
  async openDm(
    @Req() request: Request,
    @Body(new ZodValidationPipe(openDmSchema)) body: OpenDmInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RoomView> {
    const result = await Effect.runPromise(
      Effect.either(this.rooms.openDm(viewer(request).id, body.username)),
    );
    if (result._tag === "Left") {
      return unwrapRoom(Effect.fail(result.left));
    }
    if (!result.right.created) {
      response.status(200);
    }
    return result.right.room;
  }

  @Post(":id/join")
  join(
    @Req() request: Request,
    @Param("id") id: string,
  ): Promise<RoomView> {
    return unwrapRoom(this.rooms.joinGroup(viewer(request).id, id));
  }
}
