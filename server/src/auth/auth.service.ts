import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Effect } from "effect";
import { findFirst } from "fp-ts/Array";
import { isNone, isSome } from "fp-ts/Option";
import { pipe } from "fp-ts/function";
import {
  defaultPreferences,
  type LoginInput,
  type SignupInput,
  type UpdateProfileInput,
} from "@chat-refine/shared";
import { DbService } from "../db/db.service.ts";
import { append, appendAll, replaceWhere } from "../db/collections.ts";
import {
  toPublicProfile,
  isPublicGroup,
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

const patchProfile = (
  profile: Profile,
  input: UpdateProfileInput,
): Profile => ({
  ...profile,
  displayName:
    input.displayName !== undefined ? input.displayName : profile.displayName,
  avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : profile.avatarUrl,
  bio: input.bio !== undefined ? input.bio : profile.bio,
  status: input.status !== undefined ? input.status : profile.status,
  preferences: input.preferences
    ? { ...profile.preferences, ...input.preferences }
    : profile.preferences,
});

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
        avatarUrl: "/avatars/01.svg",
        bio: "",
        status: "",
        preferences: defaultPreferences(),
        createdAt: new Date().toISOString(),
      };
      const persisted = yield* Effect.tryPromise({
        try: () =>
          db.update((data) => {
            if (isSome(findByUsername(data.profiles, input.username))) {
              throw new UsernameTaken();
            }
            data.profiles = append(data.profiles, profile);
            data.conversationMembers = appendAll(
              data.conversationMembers,
              data.conversations.filter(isPublicGroup).map((room) => ({
                conversationId: room.id,
                userId: profile.id,
                role: "member" as const,
                muted: false,
              })),
            );
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

  updateProfile(userId: string, input: UpdateProfileInput) {
    const db = this.db;
    return Effect.tryPromise({
      try: () =>
        db.update((data) => {
          const found = findById(data.profiles, userId);
          if (isNone(found)) {
            throw new Error("Profile missing");
          }
          const next = patchProfile(found.value, input);
          data.profiles = replaceWhere(
            data.profiles,
            (profile) => profile.id === userId,
            () => next,
          );
          return toPublicProfile(next);
        }),
      catch: (error) => new Error(String(error)),
    });
  }
}
