import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  CannotDmSelf,
  InvalidAttachment,
  MessageNotFound,
  NotAMember,
  UserNotFound,
} from "./rooms.errors.ts";
import { runRoomEffect } from "./rooms.http.ts";

describe("runRoomEffect", () => {
  it("maps domain errors to HTTP exceptions", async () => {
    await expect(runRoomEffect(Effect.fail(new NotAMember()))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(runRoomEffect(Effect.fail(new UserNotFound()))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(runRoomEffect(Effect.fail(new CannotDmSelf()))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      runRoomEffect(Effect.fail(new InvalidAttachment())),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      runRoomEffect(Effect.fail(new MessageNotFound())),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(runRoomEffect(Effect.fail(new Error("boom")))).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it("returns the success value", async () => {
    await expect(runRoomEffect(Effect.succeed(7))).resolves.toBe(7);
  });
});
