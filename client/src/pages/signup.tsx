import { A } from "@solidjs/router";

export const SignupPage = () => (
  <main class="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
    <h1 class="text-3xl font-semibold">Create account</h1>
    <form class="flex flex-col gap-4" method="post" action="/api/auth/signup">
      <label class="flex flex-col gap-1 text-sm text-[var(--muted)]">
        Username
        <input
          name="username"
          autocomplete="username"
          required
          minlength="3"
          class="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
        />
      </label>
      <label class="flex flex-col gap-1 text-sm text-[var(--muted)]">
        Display name
        <input
          name="displayName"
          autocomplete="nickname"
          required
          class="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
        />
      </label>
      <label class="flex flex-col gap-1 text-sm text-[var(--muted)]">
        Password
        <input
          name="password"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
          class="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
        />
      </label>
      <button
        type="submit"
        class="rounded-full bg-[var(--accent)] px-5 py-2.5 font-medium text-[var(--bg)]"
      >
        Create account
      </button>
    </form>
    <p class="text-sm text-[var(--muted)]">
      Already have an account?{" "}
      <A href="/login" class="text-[var(--accent)]">
        Sign in
      </A>
    </p>
  </main>
);
