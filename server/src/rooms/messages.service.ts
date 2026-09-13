import { Inject, Injectable } from "@nestjs/common";
import { Effect } from "effect";
import type { ChatMessage, PostMessageInput } from "@chat-refine/shared";
import { DbService } from "../db/db.service.ts";
import type { StoredAttachment, StoredMessage } from "../db/schema.ts";
import {
  InvalidAttachment,
  MessageNotFound,
  NotAMember,
} from "./rooms.errors.ts";
import { RoomsService, toPublicMessage } from "./rooms.service.ts";

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
]);

const MAX_FILE_BYTES = 1_000_000;

const decodedBytes = (data: string): number => {
  try {
    return Buffer.from(data, "base64").length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
};

const storedAttachment = (
  input: NonNullable<PostMessageInput["attachment"]>,
): StoredAttachment | InvalidAttachment => {
  if (!ALLOWED_MIME.has(input.mime)) {
    return new InvalidAttachment();
  }
  const size = decodedBytes(input.data);
  if (size < 1 || size > MAX_FILE_BYTES) {
    return new InvalidAttachment();
  }
  return { name: input.name, mime: input.mime, size, data: input.data };
};

const byTimeThenId = (left: StoredMessage, right: StoredMessage): number => {
  const byTime = left.createdAt.localeCompare(right.createdAt);
  return byTime !== 0
    ? byTime
    : left.clientMessageId.localeCompare(right.clientMessageId);
};

@Injectable()
export class MessagesService {
  constructor(
    @Inject(DbService) private readonly db: DbService,
    @Inject(RoomsService) private readonly rooms: RoomsService,
  ) {}

  list(
    userId: string,
    conversationId: string,
  ): Effect.Effect<ChatMessage[], NotAMember> {
    if (!this.rooms.isMember(userId, conversationId)) {
      return Effect.fail(new NotAMember());
    }
    const rows = this.db
      .snapshot()
      .messages.filter((item) => item.conversationId === conversationId)
      .slice()
      .sort(byTimeThenId)
      .slice(-200)
      .map(toPublicMessage);
    return Effect.succeed(rows);
  }

  post(
    userId: string,
    conversationId: string,
    input: PostMessageInput,
  ): Effect.Effect<ChatMessage, NotAMember | InvalidAttachment | Error> {
    if (!this.rooms.isMember(userId, conversationId)) {
      return Effect.fail(new NotAMember());
    }
    const attachment = input.attachment
      ? storedAttachment(input.attachment)
      : undefined;
    if (attachment instanceof InvalidAttachment) {
      return Effect.fail(attachment);
    }
    const db = this.db;
    return Effect.tryPromise({
      try: () =>
        db.update((data) => {
          const existing = data.messages.find(
            (item) => item.clientMessageId === input.clientMessageId,
          );
          if (existing) {
            return toPublicMessage(existing);
          }
          const stored: StoredMessage = {
            clientMessageId: input.clientMessageId,
            conversationId,
            fromUserId: userId,
            body: input.body,
            createdAt: input.createdAt ?? new Date().toISOString(),
            attachment,
          };
          data.messages.push(stored);
          return toPublicMessage(stored);
        }),
      catch: (error) => new Error(String(error)),
    });
  }

  markRead(
    userId: string,
    conversationId: string,
  ): Effect.Effect<void, NotAMember | Error> {
    if (!this.rooms.isMember(userId, conversationId)) {
      return Effect.fail(new NotAMember());
    }
    const db = this.db;
    return Effect.tryPromise({
      try: () =>
        db.update((data) => {
          const now = new Date().toISOString();
          const found = data.readCursors.find(
            (item) =>
              item.userId === userId && item.conversationId === conversationId,
          );
          if (found) {
            found.lastReadAt = now;
            return;
          }
          data.readCursors.push({ userId, conversationId, lastReadAt: now });
        }),
      catch: (error) => new Error(String(error)),
    });
  }

  file(
    userId: string,
    conversationId: string,
    messageId: string,
  ): Effect.Effect<StoredAttachment, NotAMember | MessageNotFound> {
    if (!this.rooms.isMember(userId, conversationId)) {
      return Effect.fail(new NotAMember());
    }
    const found = this.db
      .snapshot()
      .messages.find(
        (item) =>
          item.clientMessageId === messageId &&
          item.conversationId === conversationId,
      );
    if (!found?.attachment) {
      return Effect.fail(new MessageNotFound());
    }
    return Effect.succeed(found.attachment);
  }
}
