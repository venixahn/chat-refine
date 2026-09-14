import { upsertMessage, type ChatMessage } from "@chat-refine/shared";

export type HistoryStore = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const storageKey = (conversationId: string) =>
  `chat-refine:history:${conversationId}`;

const memoryStore = (): HistoryStore => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

export const defaultHistoryStore = (): HistoryStore => {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage;
    }
  } catch {
    // Node tests have no window storage.
  }
  return memoryStore();
};

export const loadHistory = (
  conversationId: string,
  store: HistoryStore = defaultHistoryStore(),
): ChatMessage[] => {
  try {
    const raw = store.getItem(storageKey(conversationId));
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
  } catch {
    return [];
  }
};

export const persistMessage = (
  conversationId: string,
  incoming: ChatMessage,
  store: HistoryStore = defaultHistoryStore(),
): ChatMessage[] => {
  const next = upsertMessage(loadHistory(conversationId, store), incoming);
  store.setItem(storageKey(conversationId), JSON.stringify(next.slice(-500)));
  return next;
};

export const persistAll = (
  conversationId: string,
  incoming: readonly ChatMessage[],
  store: HistoryStore = defaultHistoryStore(),
): ChatMessage[] =>
  incoming.reduce(
    (_, item) => persistMessage(conversationId, item, store),
    loadHistory(conversationId, store),
  );
