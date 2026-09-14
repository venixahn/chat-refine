import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { Effect } from "effect";

const isTagged = (error: unknown): error is { readonly _tag: string } =>
  Boolean(error) && typeof error === "object" && "_tag" in error;

const httpByTag: Record<string, () => Error> = {
  NotAMember: () => new ForbiddenException(),
  UserNotFound: () => new NotFoundException(),
  CannotDmSelf: () => new BadRequestException("Cannot message yourself"),
  InvalidAttachment: () => new BadRequestException("Invalid attachment"),
  MessageNotFound: () => new NotFoundException(),
  NotAuthor: () => new ForbiddenException(),
  NotAGroup: () => new BadRequestException("Not a channel"),
};

export const runRoomEffect = async <A, E>(
  effect: Effect.Effect<A, E>,
): Promise<A> => {
  const result = await Effect.runPromise(Effect.either(effect));
  if (result._tag === "Right") {
    return result.right;
  }
  const toHttp = isTagged(result.left) ? httpByTag[result.left._tag] : undefined;
  throw toHttp ? toHttp() : new InternalServerErrorException();
};
