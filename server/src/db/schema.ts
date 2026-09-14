import { defaultPreferences, type UserPreferences } from "@chat-refine/shared";

export type Profile = {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  status: string;
  preferences: UserPreferences;
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
  data?: string;
  blobId?: string;
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
  for (const profile of data.profiles) {
    profile.bio ??= "";
    profile.status ??= "";
    profile.preferences ??= defaultPreferences();
  }
};

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  status: string;
  preferences: UserPreferences;
};

export const toPublicProfile = (profile: Profile): PublicProfile => ({
  id: profile.id,
  username: profile.username,
  displayName: profile.displayName,
  avatarUrl: profile.avatarUrl,
  bio: profile.bio ?? "",
  status: profile.status ?? "",
  preferences: profile.preferences ?? defaultPreferences(),
});
