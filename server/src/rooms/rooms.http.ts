import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { Effect } from "effect";
import {
  CannotDmSelf,
  InvalidAttachment,
  MessageNotFound,
  NotAGroup,
  NotAMember,
  NotAuthor,
  UserNotFound,
} from "./rooms.errors.ts";

export const runRoomEffect = async <A, E>(
  effect: Effect.Effect<A, E>,
): Promise<A> => {
  const result = await Effect.runPromise(Effect.either(effect));
  if (result._tag === "Left") {
    const error = result.left;
    if (error instanceof NotAMember) {
      throw new ForbiddenException();
    }
    if (error instanceof UserNotFound) {
      throw new NotFoundException();
    }
    if (error instanceof CannotDmSelf) {
      throw new BadRequestException("Cannot message yourself");
    }
    if (error instanceof InvalidAttachment) {
      throw new BadRequestException("Invalid attachment");
    }
    if (error instanceof MessageNotFound) {
      throw new NotFoundException();
    }
    if (error instanceof NotAuthor) {
      throw new ForbiddenException();
    }
    if (error instanceof NotAGroup) {
      throw new BadRequestException("Not a channel");
    }
    throw new InternalServerErrorException();
  }
  return result.right;
};
