export type Profile = {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
};

export type Conversation = {
  id: string;
  kind: "group" | "dm";
  slug?: string;
  name?: string;
  createdAt: string;
};

export type ConversationMember = {
  conversationId: string;
  userId: string;
};

export type StoredAttachment = {
  name: string;
  mime: string;
  size: number;
  data: string;
};

export type StoredMessage = {
  clientMessageId: string;
  conversationId: string;
  fromUserId: string;
  body: string;
  createdAt: string;
  attachment?: StoredAttachment;
};

export type ReadCursor = {
  userId: string;
  conversationId: string;
  lastReadAt: string;
};

export type DbSchema = {
  profiles: Profile[];
  conversations: Conversation[];
  conversationMembers: ConversationMember[];
  messages: StoredMessage[];
  readCursors: ReadCursor[];
};

export const emptyDb = (): DbSchema => ({
  profiles: [],
  conversations: [],
  conversationMembers: [],
  messages: [],
  readCursors: [],
});

export const normalizeDb = (data: DbSchema): void => {
  data.messages ??= [];
  data.readCursors ??= [];
};

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export const toPublicProfile = (profile: Profile): PublicProfile => ({
  id: profile.id,
  username: profile.username,
  displayName: profile.displayName,
  avatarUrl: profile.avatarUrl,
});
