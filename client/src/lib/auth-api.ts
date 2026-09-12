export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

const request = async <T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number }> => {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    return { ok: false, status: response.status };
  }
  if (response.status === 204) {
    return { ok: true, data: undefined as T };
  }
  return { ok: true, data: (await response.json()) as T };
};

export const signup = (body: {
  username: string;
  displayName: string;
  password: string;
}) =>
  request<PublicProfile>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const login = (body: { username: string; password: string }) =>
  request<PublicProfile>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const me = () => request<PublicProfile>("/api/auth/me");

export const logout = () =>
  request<{ ok: true }>("/api/auth/logout", { method: "POST" });
