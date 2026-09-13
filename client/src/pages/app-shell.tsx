import { A, useLocation, useNavigate } from "@solidjs/router";
import {
  For,
  Show,
  createResource,
  createSignal,
  onCleanup,
  onMount,
  type JSX,
} from "solid-js";
import { logout, me, type PublicProfile } from "../lib/auth-api.ts";
import {
  createGroup,
  joinGroup,
  listDirectory,
  listPeople,
  listRooms,
  openDm,
  type DirectoryRoom,
  type RoomView,
} from "../lib/rooms-api.ts";

const matches = (value: string, query: string) =>
  value.toLowerCase().includes(query.toLowerCase());

const asideClass = (thread: boolean) =>
  `flex w-full shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface)] md:w-72 ${
    thread ? "hidden md:flex" : "flex"
  }`;

const paneClass = (thread: boolean) =>
  `min-w-0 flex-1 ${thread ? "flex" : "hidden md:flex"}`;

const profileName = (profile: PublicProfile | null | undefined) =>
  profile?.displayName ?? "Loading…";

const profileHandle = (profile: PublicProfile | null | undefined) =>
  profile?.username ?? "…";

export const AppShell = (props: { children?: JSX.Element }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const inThread = () => location.pathname.startsWith("/app/c/");
  const [tick, setTick] = createSignal(0);
  const [groupName, setGroupName] = createSignal("");
  const [dmName, setDmName] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [paletteOpen, setPaletteOpen] = createSignal(false);
  const [paletteQuery, setPaletteQuery] = createSignal("");

  const [profile] = createResource(async () => {
    const result = await me();
    if (!result.ok) {
      navigate("/login", { replace: true });
      return null;
    }
    return result.data;
  });

  const [rooms] = createResource(tick, async () => {
    const result = await listRooms();
    return result.ok ? result.data : [];
  });

  const [directory] = createResource(tick, async () => {
    const result = await listDirectory();
    return result.ok ? result.data : [];
  });

  const [people] = createResource(tick, async () => {
    const result = await listPeople();
    return result.ok ? result.data : [];
  });

  const refresh = () => setTick((value) => value + 1);

  const groups = () =>
    (rooms() ?? []).filter((room) => room.kind === "group");
  const dms = () => (rooms() ?? []).filter((room) => room.kind === "dm");
  const joinable = () =>
    (directory() ?? []).filter((room) => !room.joined);

  const goTo = (room: RoomView) => {
    setPaletteOpen(false);
    navigate(`/app/c/${room.id}`);
  };

  const onCreateGroup: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (
    event,
  ) => {
    event.preventDefault();
    setError(null);
    const result = await createGroup(groupName());
    if (!result.ok) {
      setError("Could not create that room.");
      return;
    }
    setGroupName("");
    refresh();
    goTo(result.data);
  };

  const onOpenDm: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (
    event,
  ) => {
    event.preventDefault();
    setError(null);
    const result = await openDm(dmName().trim());
    if (!result.ok) {
      setError(
        result.status === 404
          ? "No one on this server has that username."
          : "Could not open that conversation.",
      );
      return;
    }
    setDmName("");
    refresh();
    goTo(result.data);
  };

  const onJoin = async (room: DirectoryRoom) => {
    const result = await joinGroup(room.id);
    if (!result.ok) {
      setError("Could not join that room.");
      return;
    }
    refresh();
    goTo(result.data);
  };

  const signOut = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const paletteItems = () => {
    const query = paletteQuery().trim();
    const roomHits = (rooms() ?? []).filter(
      (room) => !query || matches(room.title, query),
    );
    const peopleHits = (people() ?? []).filter(
      (person) =>
        !query ||
        matches(person.username, query) ||
        matches(person.displayName, query),
    );
    return { roomHits, peopleHits };
  };

  const openPerson = async (person: PublicProfile) => {
    const result = await openDm(person.username);
    if (result.ok) {
      refresh();
      goTo(result.data);
    }
  };

  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteQuery("");
        setPaletteOpen((open) => !open);
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  return (
    <div class="flex min-h-screen bg-[var(--bg)]">
      <aside class={asideClass(inThread())}>
        <div class="border-b border-[var(--line)] px-5 py-5">
          <p class="text-xs tracking-[0.2em] text-[var(--accent)] uppercase">
            Signed in
          </p>
          <h1 class="mt-2 text-2xl font-semibold">
            {profileName(profile())}
          </h1>
          <p class="text-sm text-[var(--muted)]">
            @{profileHandle(profile())}
          </p>
        </div>
        <div class="flex-1 space-y-6 overflow-y-auto px-4 py-5">
          <section>
            <h2 class="mb-2 text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
              Rooms
            </h2>
            <ul class="flex flex-col gap-1">
              <For each={groups()}>
                {(room) => (
                  <li>
                    <A
                      href={`/app/c/${room.id}`}
                      class="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--bg)]"
                    >
                      {room.title}
                    </A>
                  </li>
                )}
              </For>
            </ul>
          </section>
          <section>
            <h2 class="mb-2 text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
              Direct
            </h2>
            <ul class="flex flex-col gap-1">
              <For each={dms()} fallback={<li class="px-3 text-sm text-[var(--muted)]">None yet</li>}>
                {(room) => (
                  <li>
                    <A
                      href={`/app/c/${room.id}`}
                      class="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--bg)]"
                    >
                      {room.title}
                    </A>
                  </li>
                )}
              </For>
            </ul>
          </section>
          <Show when={joinable().length > 0}>
            <section>
              <h2 class="mb-2 text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
                Join
              </h2>
              <ul class="flex flex-col gap-1">
                <For each={joinable()}>
                  {(room) => (
                    <li>
                      <button
                        type="button"
                        class="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--bg)]"
                        onClick={() => void onJoin(room)}
                      >
                        Join {room.title}
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </section>
          </Show>
          <form class="flex flex-col gap-2" onSubmit={onCreateGroup}>
            <label class="text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
              New room
              <input
                value={groupName()}
                onInput={(event) => setGroupName(event.currentTarget.value)}
                class="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--text)]"
              />
            </label>
            <button
              type="submit"
              class="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm"
            >
              Create room
            </button>
          </form>
          <form class="flex flex-col gap-2" onSubmit={onOpenDm}>
            <label class="text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
              Find username
              <input
                value={dmName()}
                onInput={(event) => setDmName(event.currentTarget.value)}
                placeholder="username"
                class="mt-2 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--text)]"
              />
            </label>
            <button
              type="submit"
              class="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm"
            >
              Open DM
            </button>
          </form>
          <Show when={error()}>
            <p class="text-sm text-red-300">{error()}</p>
          </Show>
        </div>
        <div class="flex items-center justify-between border-t border-[var(--line)] px-4 py-4">
          <button
            type="button"
            class="text-sm text-[var(--muted)]"
            onClick={() => setPaletteOpen(true)}
          >
            Jump · Ctrl+K
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            class="rounded-full border border-[var(--line)] px-4 py-1.5 text-sm"
          >
            Sign out
          </button>
        </div>
      </aside>
      <div class={paneClass(inThread())}>
        {props.children}
      </div>
      <Show when={paletteOpen()}>
        <div
          class="fixed inset-0 z-20 flex items-start justify-center bg-black/50 pt-24"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            class="w-full max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <input
              autofocus
              placeholder="Jump to a room or person"
              value={paletteQuery()}
              onInput={(event) => setPaletteQuery(event.currentTarget.value)}
              class="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
            />
            <ul class="mt-3 max-h-80 overflow-y-auto">
              <For each={paletteItems().roomHits}>
                {(room) => (
                  <li>
                    <button
                      type="button"
                      class="w-full rounded-lg px-3 py-2 text-left hover:bg-[var(--bg)]"
                      onClick={() => goTo(room)}
                    >
                      {room.title}
                    </button>
                  </li>
                )}
              </For>
              <For each={paletteItems().peopleHits}>
                {(person) => (
                  <li>
                    <button
                      type="button"
                      class="w-full rounded-lg px-3 py-2 text-left hover:bg-[var(--bg)]"
                      onClick={() => void openPerson(person)}
                    >
                      {person.displayName} · @{person.username}
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </div>
      </Show>
    </div>
  );
};
