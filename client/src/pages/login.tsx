import { A } from "@solidjs/router";

export const LoginPage = () => (
  <main class="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
    <h1 class="text-3xl font-semibold">Sign in</h1>
    <form class="flex flex-col gap-4" method="post" action="/api/auth/login">
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
      <button
        type="submit"
        class="rounded-full bg-[var(--accent)] px-5 py-2.5 font-medium text-[var(--bg)]"
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
