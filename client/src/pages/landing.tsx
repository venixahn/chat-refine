import { A } from "@solidjs/router";

export const LandingPage = () => (
  <main class="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-6">
    <p class="text-sm tracking-[0.2em] text-[var(--accent)] uppercase">
      On-prem peer-to-peer
    </p>
    <h1 class="text-5xl font-semibold tracking-tight">chat-refine</h1>
    <p class="text-lg text-[var(--muted)]">
      Sign in on this server. Talk and call through WebRTC — not through the
      host.
    </p>
    <div class="flex gap-3">
      <A
        href="/signup"
        class="rounded-full bg-[var(--accent)] px-5 py-2.5 font-medium text-[var(--bg)]"
      >
        Create account
      </A>
      <A
        href="/login"
        class="rounded-full border border-[var(--line)] px-5 py-2.5 text-[var(--text)]"
      >
        Sign in
      </A>
    </div>
  </main>
);
