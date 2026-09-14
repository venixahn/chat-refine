export const AppHomePage = () => (
  <main class="flex h-screen flex-col justify-center gap-4 px-8">
    <p class="text-sm tracking-[0.2em] text-[var(--accent)] uppercase">
      Conversations
    </p>
    <h2 class="text-3xl font-semibold">Pick a room</h2>
    <p class="max-w-md text-[var(--muted)]">
      History lives on this server so you can pick up a thread on another
      device. Live text stays on a WebRTC mesh; calls go through Nest’s SFU.
    </p>
  </main>
);
