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

export type DbSchema = {
  profiles: Profile[];
  conversations: Conversation[];
  conversationMembers: ConversationMember[];
};

export const emptyDb = (): DbSchema => ({
  profiles: [],
  conversations: [],
  conversationMembers: [],
});

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
