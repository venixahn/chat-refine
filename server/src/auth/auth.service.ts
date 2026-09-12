import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Effect } from "effect";
import { findFirst } from "fp-ts/Array";
import { isNone, isSome } from "fp-ts/Option";
import { pipe } from "fp-ts/function";
import type { LoginInput, SignupInput } from "@chat-refine/shared";
import { DbService } from "../db/db.service.ts";
import {
  toPublicProfile,
  type Profile,
  type PublicProfile,
} from "../db/schema.ts";
import { InvalidCredentials, UsernameTaken } from "./auth.errors.ts";
import { hashPassword, verifyPassword } from "./password.ts";

const findByUsername = (profiles: Profile[], username: string) =>
  pipe(
    profiles,
    findFirst((profile) => profile.username === username),
  );

const findById = (profiles: Profile[], id: string) =>
  pipe(
    profiles,
    findFirst((profile) => profile.id === id),
  );

@Injectable()
export class AuthService {
  constructor(@Inject(DbService) private readonly db: DbService) {}

  signup(input: SignupInput) {
    const db = this.db;
    return Effect.gen(function* () {
      const taken = findByUsername(db.snapshot().profiles, input.username);
      if (isSome(taken)) {
        return yield* Effect.fail(new UsernameTaken());
      }
      const passwordHash = yield* hashPassword(input.password);
      const profile: Profile = {
        id: randomUUID(),
        username: input.username,
        passwordHash,
        displayName: input.displayName,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
      };
      const persisted = yield* Effect.tryPromise({
        try: () =>
          db.update((data) => {
            if (isSome(findByUsername(data.profiles, input.username))) {
              throw new UsernameTaken();
            }
            data.profiles.push(profile);
            for (const room of data.conversations.filter(
              (conversation) => conversation.kind === "group",
            )) {
              data.conversationMembers.push({
                conversationId: room.id,
                userId: profile.id,
              });
            }
            return toPublicProfile(profile);
          }),
        catch: (error) =>
          error instanceof UsernameTaken
            ? error
            : { _tag: "CryptoFailure" as const, message: String(error) },
      });
      return persisted;
    });
  }

  verify(input: LoginInput) {
    const db = this.db;
    return Effect.gen(function* () {
      const found = findByUsername(db.snapshot().profiles, input.username);
      if (isNone(found)) {
        return yield* Effect.fail(new InvalidCredentials());
      }
      const matches = yield* verifyPassword(
        input.password,
        found.value.passwordHash,
      );
      if (!matches) {
        return yield* Effect.fail(new InvalidCredentials());
      }
      return toPublicProfile(found.value);
    });
  }

  publicById(id: string): PublicProfile | undefined {
    const found = findById(this.db.snapshot().profiles, id);
    return isSome(found) ? toPublicProfile(found.value) : undefined;
  }
}
