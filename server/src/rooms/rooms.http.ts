import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { Effect } from "effect";
import { CannotDmSelf, NotAMember, UserNotFound } from "./rooms.errors.ts";

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
    throw new InternalServerErrorException();
  }
  return result.right;
};
