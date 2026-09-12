import { request, type PublicProfile } from "./auth-api.ts";

export type RoomView = {
  id: string;
  kind: "group" | "dm";
  slug?: string;
  name?: string;
  title: string;
  createdAt: string;
  members: PublicProfile[];
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

export const openDm = (username: string) =>
  request<RoomView>("/api/rooms/dm", {
    method: "POST",
    body: JSON.stringify({ username }),
  });

export const listPeople = (q?: string) => {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  return request<PublicProfile[]>(`/api/users${query}`);
};

export const signalTicket = () =>
  request<{ ticket: string; expiresAt: string }>("/api/signal/ticket");
