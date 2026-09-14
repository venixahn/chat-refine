import { fromCompare } from "fp-ts/Ord";
import { sort } from "fp-ts/Array";
import { pipe } from "fp-ts/function";

export type MessageAttachment = {
  name: string;
  mime: string;
  size: number;
};

export type ChatMessage = {
  clientMessageId: string;
  conversationId: string;
  body: string;
  createdAt: string;
  fromUserId: string;
  editedAt?: string;
  deletedAt?: string;
  attachment?: MessageAttachment;
};

export const previewOf = (message: ChatMessage): string => {
  if (message.deletedAt) {
    return "This message was deleted";
  }
  const caption = message.body.trim();
  if (caption) {
    return caption;
  }
  if (message.attachment) {
    return message.attachment.name;
  }
  return "Message";
};

export const messageOrd = fromCompare<ChatMessage>((left, right) => {
  if (left.createdAt < right.createdAt) {
    return -1;
  }
  if (left.createdAt > right.createdAt) {
    return 1;
  }
  if (left.clientMessageId < right.clientMessageId) {
    return -1;
  }
  if (left.clientMessageId > right.clientMessageId) {
    return 1;
  }
  return 0;
});

export const upsertMessage = (
  messages: readonly ChatMessage[],
  incoming: ChatMessage,
): ChatMessage[] => {
  const without = messages.filter(
    (item) => item.clientMessageId !== incoming.clientMessageId,
  );
  return pipe([...without, incoming], sort(messageOrd));
};
