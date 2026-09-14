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
  topic?: string;
  visibility?: "public" | "private";
  createdAt: string;
};

export type ConversationMember = {
  conversationId: string;
  userId: string;
  role?: "owner" | "member";
  muted?: boolean;
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
  editedAt?: string;
  deletedAt?: string;
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

export const isPublicGroup = (room: Conversation): boolean =>
  room.kind === "group" && room.visibility !== "private";

const fillProfile = (profile: Profile): Profile => ({
  ...profile,
  bio: profile.bio ?? "",
  status: profile.status ?? "",
  preferences: profile.preferences ?? defaultPreferences(),
});

const fillRoom = (room: Conversation): Conversation => ({
  ...room,
  topic: room.topic ?? "",
  visibility: room.visibility ?? (room.kind === "dm" ? "private" : "public"),
});

const fillMember = (member: ConversationMember): ConversationMember => ({
  ...member,
  role: member.role ?? "member",
  muted: member.muted ?? false,
});

export const seededRooms = (data: DbSchema, now: string): Conversation[] => {
  if (data.conversations.length > 0) {
    return data.conversations;
  }
  return [
    {
      id: "room-general",
      kind: "group",
      slug: "general",
      name: "general",
      createdAt: now,
    },
    {
      id: "room-random",
      kind: "group",
      slug: "random",
      name: "random",
      createdAt: now,
    },
  ];
};

export const normalizeDb = (data: DbSchema): DbSchema => ({
  ...data,
  messages: data.messages ?? [],
  readCursors: data.readCursors ?? [],
  profiles: data.profiles.map(fillProfile),
  conversations: data.conversations.map(fillRoom),
  conversationMembers: data.conversationMembers.map(fillMember),
});

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
