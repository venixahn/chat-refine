export const AppHomePage = () => (
  <main class="flex h-screen flex-col justify-center gap-4 px-8">
    <p class="text-sm tracking-[0.2em] text-[var(--accent)] uppercase">
      Conversations
    </p>
    <h2 class="text-3xl font-semibold">Pick a room</h2>
    <p class="max-w-md text-[var(--muted)]">
      Text travels on WebRTC data channels between browsers. Nest only keeps
      the room list and signaling.
    </p>
  </main>
);
