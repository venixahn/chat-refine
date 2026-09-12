import { findFirst } from "fp-ts/Array";
import { fromCompare } from "fp-ts/Ord";
import { sort } from "fp-ts/Array";
import { isSome } from "fp-ts/Option";
import { pipe } from "fp-ts/function";

export type ChatMessage = {
  clientMessageId: string;
  conversationId: string;
  body: string;
  createdAt: string;
  fromUserId: string;
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
  if (
    isSome(
      pipe(
        [...messages],
        findFirst((item) => item.clientMessageId === incoming.clientMessageId),
      ),
    )
  ) {
    return [...messages];
  }
  return pipe([...messages, incoming], sort(messageOrd));
};
