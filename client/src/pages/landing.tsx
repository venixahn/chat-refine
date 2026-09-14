import { A } from "@solidjs/router";

export const LandingPage = () => (
  <main class="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6">
    <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">chat-refine</h1>
    <p class="text-lg text-[var(--muted)]">
      Sign in on this server and pick up the conversation.
    </p>
    <div class="flex flex-wrap gap-3">
      <A
        href="/signup"
        class="rounded-lg bg-[var(--accent)] px-5 py-2.5 font-medium text-[var(--bg)]"
      >
        Create account
      </A>
      <A
        href="/login"
        class="rounded-lg border border-[var(--line)] px-5 py-2.5 text-[var(--text)]"
      >
        Sign in
      </A>
    </div>
  </main>
);
