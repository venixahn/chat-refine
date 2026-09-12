import { A, useNavigate } from "@solidjs/router";
import { createSignal, type JSX } from "solid-js";
import { login } from "../lib/auth-api.ts";

export const LoginPage = () => {
  const navigate = useNavigate();
  const [error, setError] = createSignal<string | null>(null);
  const [pending, setPending] = createSignal(false);

  const onSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (
    event,
  ) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await login({
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    setPending(false);
    if (!result.ok) {
      setError("Invalid username or password.");
      return;
    }
    navigate("/app", { replace: true });
  };

  return (
    <main class="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <h1 class="text-3xl font-semibold">Sign in</h1>
      <form class="flex flex-col gap-4" onSubmit={onSubmit}>
        <label class="flex flex-col gap-1 text-sm text-[var(--muted)]">
          Username
          <input
            name="username"
            autocomplete="username"
            required
            class="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm text-[var(--muted)]">
          Password
          <input
            name="password"
            type="password"
            autocomplete="current-password"
            required
            class="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
          />
        </label>
        {error() ? <p class="text-sm text-red-300">{error()}</p> : null}
        <button
          type="submit"
          disabled={pending()}
          class="rounded-full bg-[var(--accent)] px-5 py-2.5 font-medium text-[var(--bg)] disabled:opacity-60"
        >
          Sign in
        </button>
      </form>
      <p class="text-sm text-[var(--muted)]">
        New here?{" "}
        <A href="/signup" class="text-[var(--accent)]">
          Create an account
        </A>
      </p>
    </main>
  );
};
