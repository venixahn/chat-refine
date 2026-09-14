import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Effect } from "effect";
import { filter, findFirst, map } from "fp-ts/Array";
import { isNone, isSome } from "fp-ts/Option";
import { pipe } from "fp-ts/function";
import {
  dmPairKey,
  rankPeople,
  type ChatMessage,
  type CreateGroupInput,
  type OpenDmInput,
} from "@chat-refine/shared";
import { DbService } from "../db/db.service.ts";
import {
  toPublicProfile,
  type Conversation,
  type DbSchema,
  type PublicProfile,
  type StoredMessage,
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
  lastMessage?: ChatMessage;
  unreadCount: number;
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

const shareDm = (data: DbSchema, left: string, right: string): boolean =>
  data.conversations.some((room) => {
    if (room.kind !== "dm") {
      return false;
    }
    return (
      isMemberOf(data.conversationMembers, room.id, left) &&
      isMemberOf(data.conversationMembers, room.id, right)
    );
  });

const visibleTo = (
  data: DbSchema,
  viewerId: string,
  profile: PublicProfile,
): boolean => {
  const visibility = profile.preferences?.visibility ?? "everyone";
  if (visibility === "hidden") {
    return false;
  }
  if (visibility === "contacts") {
    return shareDm(data, viewerId, profile.id);
  }
  return true;
};

const firstText = (...values: Array<string | undefined>): string =>
  values.find((value) => Boolean(value)) ?? "Direct message";

const membersOf = (room: Conversation, data: DbSchema): PublicProfile[] =>
  data.conversationMembers
    .filter((member) => member.conversationId === room.id)
    .flatMap((member) => {
      const profile = data.profiles.find((item) => item.id === member.userId);
      return profile ? [toPublicProfile(profile)] : [];
    });

const roomTitle = (
  room: Conversation,
  members: PublicProfile[],
  viewerId: string,
): string => {
  if (room.kind !== "dm") {
    return room.name ?? "Room";
  }
  const peer = members.find((member) => member.id !== viewerId);
  return firstText(peer?.displayName, peer?.username, room.name);
};

export const toPublicMessage = (stored: StoredMessage): ChatMessage => ({
  clientMessageId: stored.clientMessageId,
  conversationId: stored.conversationId,
  fromUserId: stored.fromUserId,
  body: stored.body,
  createdAt: stored.createdAt,
  attachment: stored.attachment
    ? {
        name: stored.attachment.name,
        mime: stored.attachment.mime,
        size: stored.attachment.size,
      }
    : undefined,
});

const lastStored = (
  conversationId: string,
  data: DbSchema,
): StoredMessage | undefined =>
  data.messages
    .filter((item) => item.conversationId === conversationId)
    .reduce<StoredMessage | undefined>((latest, item) => {
      if (!latest) {
        return item;
      }
      if (item.createdAt > latest.createdAt) {
        return item;
      }
      if (item.createdAt < latest.createdAt) {
        return latest;
      }
      return item.clientMessageId > latest.clientMessageId ? item : latest;
    }, undefined);

const readSince = (
  userId: string,
  conversationId: string,
  data: DbSchema,
): string =>
  data.readCursors.find(
    (item) => item.userId === userId && item.conversationId === conversationId,
  )?.lastReadAt ?? "";

const unreadCountOf = (
  conversationId: string,
  userId: string,
  data: DbSchema,
): number => {
  const since = readSince(userId, conversationId, data);
  return data.messages.filter(
    (item) =>
      item.conversationId === conversationId &&
      item.fromUserId !== userId &&
      item.createdAt > since,
  ).length;
};

const toRoomView = (
  room: Conversation,
  viewerId: string,
  data: DbSchema,
): RoomView => {
  const members = membersOf(room, data);
  const last = lastStored(room.id, data);
  return {
    id: room.id,
    kind: room.kind,
    slug: room.slug,
    name: room.name,
    title: roomTitle(room, members, viewerId),
    createdAt: room.createdAt,
    members,
    lastMessage: last ? toPublicMessage(last) : undefined,
    unreadCount: unreadCountOf(room.id, viewerId, data),
  };
};

const activityAt = (room: RoomView): string =>
  room.lastMessage?.createdAt ?? room.createdAt;

const byActivityDesc = (left: RoomView, right: RoomView): number => {
  const byTime = activityAt(right).localeCompare(activityAt(left));
  return byTime !== 0 ? byTime : right.id.localeCompare(left.id);
};

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
      map((option) => toRoomView(option.value, userId, data)),
    ).sort(byActivityDesc);
  }

  listDirectory(userId: string): DirectoryRoom[] {
    const data = this.db.snapshot();
    return data.conversations
      .filter((room) => room.kind === "group")
      .map((room) => ({
        ...toRoomView(room, userId, data),
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
    return Effect.succeed(toRoomView(room.value, userId, data));
  }

  createGroup(userId: string, input: CreateGroupInput) {
    const db = this.db;
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
          return toRoomView(room, userId, data);
        }),
      catch: (error) => new Error(String(error)),
    });
  }

  joinGroup(userId: string, conversationId: string) {
    const db = this.db;
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
          return toRoomView(room.value, userId, current);
        }),
      catch: (error) => new Error(String(error)),
    });
  }

  openDm(userId: string, input: OpenDmInput) {
    const db = this.db;
    const peer = pipe(
      db.snapshot().profiles,
      findFirst((profile) =>
        "userId" in input
          ? profile.id === input.userId
          : profile.username === input.username,
      ),
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
            return { room: toRoomView(existing.value, userId, data), created: false };
          }
          const room: Conversation = {
            id: randomUUID(),
            kind: "dm",
            slug: key,
            name: peer.value.username,
            createdAt: new Date().toISOString(),
          };
          data.conversations.push(room);
          data.conversationMembers.push(
            { conversationId: room.id, userId },
            { conversationId: room.id, userId: peer.value.id },
          );
          return { room: toRoomView(room, userId, data), created: true };
        }),
      catch: (error) => new Error(String(error)),
    });
  }

  listPeople(userId: string, query = ""): PublicProfile[] {
    const data = this.db.snapshot();
    const visible = data.profiles
      .filter((profile) => profile.id !== userId)
      .map(toPublicProfile)
      .filter((profile) => visibleTo(data, userId, profile));
    return rankPeople(query, visible);
  }
}
