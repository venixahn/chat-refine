import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Effect } from "effect";
import type { ChatMessage, PostMessageInput } from "@chat-refine/shared";
import { DbService } from "../db/db.service.ts";
import { append, replaceWhere, upsertWhere } from "../db/collections.ts";
import type { StoredAttachment, StoredMessage } from "../db/schema.ts";
import { FileStore } from "../files/file-store.ts";
import {
  InvalidAttachment,
  MessageNotFound,
  NotAMember,
  NotAuthor,
} from "./rooms.errors.ts";
import { RoomsService, toPublicMessage } from "./rooms.service.ts";

export type UploadedFile = {
  name: string;
  mime: string;
  buffer: Buffer;
};

const byTimeThenId = (left: StoredMessage, right: StoredMessage): number => {
  const byTime = left.createdAt.localeCompare(right.createdAt);
  return byTime !== 0
    ? byTime
    : left.clientMessageId.localeCompare(right.clientMessageId);
};

const decodedBytes = (data: string): Buffer | undefined => {
  try {
    const bytes = Buffer.from(data, "base64");
    return bytes.length > 0 ? bytes : undefined;
  } catch {
    return undefined;
  }
};

@Injectable()
export class MessagesService {
  constructor(
    @Inject(DbService) private readonly db: DbService,
    @Inject(RoomsService) private readonly rooms: RoomsService,
    @Inject(FileStore) private readonly files: FileStore,
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
    const uploaded = input.attachment
      ? this.fromBase64(input.attachment)
      : undefined;
    if (uploaded instanceof InvalidAttachment) {
      return Effect.fail(uploaded);
    }
    return this.save(userId, conversationId, {
      clientMessageId: input.clientMessageId,
      body: input.body,
      createdAt: input.createdAt,
      file: uploaded,
    });
  }

  postUpload(
    userId: string,
    conversationId: string,
    input: {
      clientMessageId: string;
      body: string;
      createdAt?: string;
      file?: UploadedFile;
    },
  ): Effect.Effect<ChatMessage, NotAMember | InvalidAttachment | Error> {
    return this.save(userId, conversationId, input);
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
          data.readCursors = upsertWhere(
            data.readCursors,
            (item) =>
              item.userId === userId && item.conversationId === conversationId,
            (item) => ({ ...item, lastReadAt: now }),
            () => ({ userId, conversationId, lastReadAt: now }),
          );
        }),
      catch: (error) => new Error(String(error)),
    });
  }

  edit(
    userId: string,
    conversationId: string,
    messageId: string,
    body: string,
  ): Effect.Effect<ChatMessage, NotAMember | NotAuthor | MessageNotFound | Error> {
    return this.rewrite(userId, conversationId, messageId, (stored) => ({
      ...stored,
      body: body.trim(),
      editedAt: new Date().toISOString(),
    }));
  }

  retract(
    userId: string,
    conversationId: string,
    messageId: string,
  ): Effect.Effect<ChatMessage, NotAMember | NotAuthor | MessageNotFound | Error> {
    return this.rewrite(userId, conversationId, messageId, (stored) => ({
      ...stored,
      deletedAt: new Date().toISOString(),
    }));
  }

  private rewrite(
    userId: string,
    conversationId: string,
    messageId: string,
    apply: (stored: StoredMessage) => StoredMessage,
  ): Effect.Effect<ChatMessage, NotAMember | NotAuthor | MessageNotFound | Error> {
    if (!this.rooms.isMember(userId, conversationId)) {
      return Effect.fail(new NotAMember());
    }
    const db = this.db;
    return Effect.tryPromise({
      try: () =>
        db.update((data) => {
          const found = data.messages.find(
            (item) =>
              item.clientMessageId === messageId &&
              item.conversationId === conversationId,
          );
          if (!found || found.deletedAt) {
            throw new MessageNotFound();
          }
          if (found.fromUserId !== userId) {
            throw new NotAuthor();
          }
          const next = apply(found);
          data.messages = replaceWhere(
            data.messages,
            (item) =>
              item.clientMessageId === messageId &&
              item.conversationId === conversationId,
            () => next,
          );
          return toPublicMessage(next);
        }),
      catch: (error) => {
        if (error instanceof MessageNotFound || error instanceof NotAuthor) {
          return error;
        }
        return new Error(String(error));
      },
    });
  }

  file(
    userId: string,
    conversationId: string,
    messageId: string,
  ): Effect.Effect<
    { attachment: StoredAttachment; bytes: Buffer },
    NotAMember | MessageNotFound | Error
  > {
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
    const attachment = found.attachment;
    return Effect.tryPromise({
      try: () => this.readBytes(attachment).then((bytes) => ({ attachment, bytes })),
      catch: () => new MessageNotFound(),
    });
  }

  private fromBase64(
    input: NonNullable<PostMessageInput["attachment"]>,
  ): UploadedFile | InvalidAttachment {
    const buffer = decodedBytes(input.data);
    if (!buffer) {
      return new InvalidAttachment();
    }
    return {
      name: input.name,
      mime: input.mime || "application/octet-stream",
      buffer,
    };
  }

  private save(
    userId: string,
    conversationId: string,
    input: {
      clientMessageId: string;
      body: string;
      createdAt?: string;
      file?: UploadedFile;
    },
  ): Effect.Effect<ChatMessage, NotAMember | InvalidAttachment | Error> {
    if (!this.rooms.isMember(userId, conversationId)) {
      return Effect.fail(new NotAMember());
    }
    if (!input.body.trim() && !input.file) {
      return Effect.fail(new InvalidAttachment());
    }
    const db = this.db;
    const files = this.files;
    return Effect.tryPromise({
      try: async () => {
        const attachment = input.file
          ? await this.persistFile(files, input.file)
          : undefined;
        return db.update((data) => {
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
          data.messages = append(data.messages, stored);
          return toPublicMessage(stored);
        });
      },
      catch: (error) =>
        error instanceof InvalidAttachment ? error : new Error(String(error)),
    });
  }

  private async persistFile(
    files: FileStore,
    file: UploadedFile,
  ): Promise<StoredAttachment> {
    if (file.buffer.length < 1) {
      throw new InvalidAttachment();
    }
    const blobId = randomUUID();
    await files.put(blobId, file.buffer);
    return {
      name: file.name.slice(0, 240) || "file",
      mime: file.mime || "application/octet-stream",
      size: file.buffer.length,
      blobId,
    };
  }

  private async readBytes(attachment: StoredAttachment): Promise<Buffer> {
    if (attachment.blobId) {
      const bytes = await this.files.get(attachment.blobId);
      if (bytes) {
        return bytes;
      }
    }
    if (attachment.data) {
      const bytes = decodedBytes(attachment.data);
      if (bytes) {
        return bytes;
      }
    }
    throw new MessageNotFound();
  }
}
