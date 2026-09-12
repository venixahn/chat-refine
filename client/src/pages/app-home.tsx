import { useNavigate } from "@solidjs/router";
import { createResource } from "solid-js";
import { logout, me } from "../lib/auth-api.ts";

export const AppHomePage = () => {
  const navigate = useNavigate();
  const [profile] = createResource(async () => {
    const result = await me();
    if (!result.ok) {
      navigate("/login", { replace: true });
      return null;
    }
    return result.data;
  });

  const signOut = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <main class="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6">
      <p class="text-sm tracking-[0.2em] text-[var(--accent)] uppercase">
        Signed in
      </p>
      <h1 class="text-4xl font-semibold">
        {profile()?.displayName ?? "Loading…"}
      </h1>
      <p class="text-[var(--muted)]">
        Rooms and calls come next. You are on this server as{" "}
        {profile()?.username ?? "…"}.
      </p>
      <button
        type="button"
        onClick={() => void signOut()}
        class="w-fit rounded-full border border-[var(--line)] px-5 py-2.5"
      >
        Sign out
      </button>
    </main>
  );
};
