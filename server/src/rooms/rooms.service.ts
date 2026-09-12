import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Effect } from "effect";
import { filter, findFirst, map } from "fp-ts/Array";
import { isNone, isSome } from "fp-ts/Option";
import { pipe } from "fp-ts/function";
import { dmPairKey, type CreateGroupInput } from "@chat-refine/shared";
import { DbService } from "../db/db.service.ts";
import {
  toPublicProfile,
  type Conversation,
  type DbSchema,
  type PublicProfile,
} from "../db/schema.ts";
import { CannotDmSelf, NotAMember, UserNotFound } from "./rooms.errors.ts";

export type RoomView = {
  id: string;
  kind: Conversation["kind"];
  slug?: string;
  name?: string;
  title: string;
  createdAt: string;
  members: PublicProfile[];
};

export type DirectoryRoom = RoomView & { joined: boolean };

export type OpenedDm = {
  room: RoomView;
  created: boolean;
};

const isMemberOf = (
  members: DbSchema["conversationMembers"],
  conversationId: string,
  userId: string,
) =>
  members.some(
    (member) =>
      member.conversationId === conversationId && member.userId === userId,
  );

const matchesQuery = (profile: PublicProfile, needle: string) =>
  needle.length === 0 ||
  profile.username.toLowerCase().includes(needle) ||
  profile.displayName.toLowerCase().includes(needle);

@Injectable()
export class RoomsService {
  constructor(@Inject(DbService) private readonly db: DbService) {}

  isMember(userId: string, conversationId: string): boolean {
    return isMemberOf(
      this.db.snapshot().conversationMembers,
      conversationId,
      userId,
    );
  }

  listFor(userId: string): RoomView[] {
    const data = this.db.snapshot();
    return pipe(
      data.conversationMembers,
      filter((member) => member.userId === userId),
      map((member) =>
        pipe(
          data.conversations,
          findFirst((room) => room.id === member.conversationId),
        ),
      ),
      filter(isSome),
      map((option) => this.view(option.value, userId, data)),
    );
  }

  listDirectory(userId: string): DirectoryRoom[] {
    const data = this.db.snapshot();
    return data.conversations
      .filter((room) => room.kind === "group")
      .map((room) => ({
        ...this.view(room, userId, data),
        joined: isMemberOf(data.conversationMembers, room.id, userId),
      }));
  }

  getIfMember(
    userId: string,
    conversationId: string,
  ): Effect.Effect<RoomView, NotAMember> {
    const data = this.db.snapshot();
    const room = pipe(
      data.conversations,
      findFirst((item) => item.id === conversationId),
    );
    if (isNone(room) || !isMemberOf(data.conversationMembers, conversationId, userId)) {
      return Effect.fail(new NotAMember());
    }
    return Effect.succeed(this.view(room.value, userId, data));
  }

  createGroup(userId: string, input: CreateGroupInput) {
    const db = this.db;
    const view = this.view.bind(this);
    return Effect.tryPromise({
      try: () =>
        db.update((data) => {
          const room: Conversation = {
            id: randomUUID(),
            kind: "group",
            slug: input.name.toLowerCase().replaceAll(" ", "-"),
            name: input.name,
            createdAt: new Date().toISOString(),
          };
          data.conversations.push(room);
          data.conversationMembers.push({
            conversationId: room.id,
            userId,
          });
          return view(room, userId, data);
        }),
      catch: (error) => new Error(String(error)),
    });
  }

  joinGroup(userId: string, conversationId: string) {
    const db = this.db;
    const view = this.view.bind(this);
    const room = pipe(
      db.snapshot().conversations,
      findFirst((item) => item.id === conversationId && item.kind === "group"),
    );
    if (isNone(room)) {
      return Effect.fail(new NotAMember());
    }
    return Effect.tryPromise({
      try: () =>
        db.update((current) => {
          if (!isMemberOf(current.conversationMembers, conversationId, userId)) {
            current.conversationMembers.push({ conversationId, userId });
          }
          return view(room.value, userId, current);
        }),
      catch: (error) => new Error(String(error)),
    });
  }

  openDm(userId: string, username: string) {
    const db = this.db;
    const view = this.view.bind(this);
    const peer = pipe(
      db.snapshot().profiles,
      findFirst((profile) => profile.username === username),
    );
    if (isNone(peer)) {
      return Effect.fail(new UserNotFound());
    }
    if (peer.value.id === userId) {
      return Effect.fail(new CannotDmSelf());
    }
    const key = `dm:${dmPairKey(userId, peer.value.id)}`;
    return Effect.tryPromise({
      try: () =>
        db.update((data): OpenedDm => {
          const existing = pipe(
            data.conversations,
            findFirst((item) => item.kind === "dm" && item.slug === key),
          );
          if (isSome(existing)) {
            return { room: view(existing.value, userId, data), created: false };
          }
          const room: Conversation = {
            id: randomUUID(),
            kind: "dm",
            slug: key,
            name: username,
            createdAt: new Date().toISOString(),
          };
          data.conversations.push(room);
          data.conversationMembers.push(
            { conversationId: room.id, userId },
            { conversationId: room.id, userId: peer.value.id },
          );
          return { room: view(room, userId, data), created: true };
        }),
      catch: (error) => new Error(String(error)),
    });
  }

  listPeople(userId: string, query = ""): PublicProfile[] {
    const needle = query.trim().toLowerCase();
    return this.db
      .snapshot()
      .profiles.filter((profile) => profile.id !== userId)
      .map(toPublicProfile)
      .filter((profile) => matchesQuery(profile, needle));
  }

  private view(
    room: Conversation,
    viewerId: string,
    data: DbSchema,
  ): RoomView {
    const members = data.conversationMembers
      .filter((member) => member.conversationId === room.id)
      .flatMap((member) => {
        const profile = data.profiles.find((item) => item.id === member.userId);
        return profile ? [toPublicProfile(profile)] : [];
      });
    const peer = members.find((member) => member.id !== viewerId);
    const title =
      room.kind === "dm"
        ? (peer?.displayName ?? peer?.username ?? room.name ?? "Direct message")
        : (room.name ?? "Room");
    return {
      id: room.id,
      kind: room.kind,
      slug: room.slug,
      name: room.name,
      title,
      createdAt: room.createdAt,
      members,
    };
  }
}
