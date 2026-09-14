import type { ChatMessage, IceServer, PostMessageInput } from "@chat-refine/shared";
import { request, type PublicProfile } from "./auth-api.ts";

export type RoomView = {
  id: string;
  kind: "group" | "dm";
  slug?: string;
  name?: string;
  title: string;
  createdAt: string;
  members: PublicProfile[];
  lastMessage?: ChatMessage;
  unreadCount: number;
};

export type DirectoryRoom = RoomView & { joined: boolean };

export const listRooms = () => request<RoomView[]>("/api/rooms");

export const listDirectory = () => request<DirectoryRoom[]>("/api/rooms/directory");

export const getRoom = (id: string) => request<RoomView>(`/api/rooms/${id}`);

export const createGroup = (name: string) =>
  request<RoomView>("/api/rooms", {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const joinGroup = (id: string) =>
  request<RoomView>(`/api/rooms/${id}/join`, { method: "POST" });

export const openDm = (target: { username: string } | { userId: string }) =>
  request<RoomView>("/api/rooms/dm", {
    method: "POST",
    body: JSON.stringify(target),
  });

export const listPeople = (q?: string) => {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  return request<PublicProfile[]>(`/api/users${query}`);
};

export const signalTicket = () =>
  request<{ ticket: string; expiresAt: string }>("/api/signal/ticket");

export const listIce = () => request<{ iceServers: IceServer[] }>("/api/ice");

export const listMessages = (id: string) =>
  request<ChatMessage[]>(`/api/rooms/${id}/messages`);

export const postMessage = (id: string, body: PostMessageInput) =>
  request<ChatMessage>(`/api/rooms/${id}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const postMessageFile = (
  id: string,
  input: { clientMessageId: string; body: string; createdAt: string; file: File },
) => {
  const form = new FormData();
  form.set("clientMessageId", input.clientMessageId);
  form.set("body", input.body);
  form.set("createdAt", input.createdAt);
  form.set("file", input.file, input.file.name);
  return request<ChatMessage>(`/api/rooms/${id}/messages/upload`, {
    method: "POST",
    body: form,
  });
};

export const markRead = (id: string) =>
  request<{ ok: true }>(`/api/rooms/${id}/read`, { method: "POST" });

export const messageFileUrl = (roomId: string, messageId: string) =>
  `/api/rooms/${roomId}/messages/${messageId}/file`;
