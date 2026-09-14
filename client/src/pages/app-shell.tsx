import { defaultPreferences, previewOf, rankPeople } from "@chat-refine/shared";
import { A, useLocation, useNavigate } from "@solidjs/router";
import {
  For,
  Show,
  createEffect,
  createResource,
  createSignal,
  onCleanup,
  onMount,
  type JSX,
} from "solid-js";
import {
  logout,
  me,
  updateProfile,
  type PublicProfile,
} from "../lib/auth-api.ts";
import { ProfileEditor } from "../components/profile-editor.tsx";
import { PeopleSearch } from "../components/people-search.tsx";
import { readAvatarDataUrl } from "../lib/file.ts";
import { startInbox } from "../lib/inbox.ts";
import { applyTheme } from "../lib/theme.ts";
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

const notifyActivity = (preview: string, conversationId: string): void => {
  const open = location.pathname === `/app/c/${conversationId}`;
  if (open || !document.hidden || Notification.permission !== "granted") {
    return;
  }
  new Notification("New message", { body: preview });
};

const RoomRow = (props: { room: RoomView }) => (
  <A
    href={`/app/c/${props.room.id}`}
    class="flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[var(--bg)]"
  >
    <span class="min-w-0">
      <span class="block truncate">{props.room.title}</span>
      <Show when={props.room.lastMessage}>
        {(message) => (
          <span class="block truncate text-xs text-[var(--muted)]">
            {previewOf(message())}
          </span>
        )}
      </Show>
    </span>
    <Show when={props.room.unreadCount > 0}>
      <span class="shrink-0 rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs text-[var(--bg)]">
        {props.room.unreadCount}
      </span>
    </Show>
  </A>
);

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
  const [editingProfile, setEditingProfile] = createSignal(false);
  const [displayDraft, setDisplayDraft] = createSignal("");
  const [bioDraft, setBioDraft] = createSignal("");
  const [statusDraft, setStatusDraft] = createSignal("");
  const [themeDraft, setThemeDraft] = createSignal(defaultPreferences().theme);
  const [visibilityDraft, setVisibilityDraft] = createSignal(
    defaultPreferences().visibility,
  );
  const [onlineDraft, setOnlineDraft] = createSignal(true);
  const [profileError, setProfileError] = createSignal<string | null>(null);
  const [notifyState, setNotifyState] = createSignal(
    typeof Notification === "undefined" ? "denied" : Notification.permission,
  );

  const [profile, { mutate }] = createResource(async () => {
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

  createEffect(() => {
    const path = location.pathname;
    if (path.length > 0) {
      refresh();
    }
  });

  onMount(() => {
    const onActivity = () => refresh();
    window.addEventListener("chat-refine:activity", onActivity);
    onCleanup(() => window.removeEventListener("chat-refine:activity", onActivity));
  });

  createEffect(() => {
    const prefs = profile()?.preferences;
    if (prefs) {
      applyTheme(prefs.theme);
    }
  });

  createEffect(() => {
    const selfId = profile()?.id;
    if (!selfId) {
      return;
    }
    let handle: { close: () => void } | undefined;
    let cancelled = false;
    void startInbox({
      onActivity: (event) => {
        refresh();
        notifyActivity(event.preview, event.conversationId);
      },
    })
      .then((started) => {
        if (cancelled) {
          started.close();
          return;
        }
        handle = started;
      })
      .catch(() => undefined);
    onCleanup(() => {
      cancelled = true;
      handle?.close();
    });
  });

  const openProfile = () => {
    const current = profile();
    if (!current) {
      return;
    }
    setDisplayDraft(current.displayName);
    setBioDraft(current.bio);
    setStatusDraft(current.status);
    setThemeDraft(current.preferences.theme);
    setVisibilityDraft(current.preferences.visibility);
    setOnlineDraft(current.preferences.showOnline);
    setProfileError(null);
    setEditingProfile(true);
  };

  const profilePatch = (avatarUrl?: string | null) => ({
    displayName: displayDraft().trim(),
    bio: bioDraft(),
    status: statusDraft(),
    preferences: {
      theme: themeDraft(),
      visibility: visibilityDraft(),
      showOnline: onlineDraft(),
    },
    ...(avatarUrl !== undefined ? { avatarUrl } : {}),
  });

  const saveProfile = async (avatarUrl?: string | null) => {
    const patch = profilePatch(avatarUrl);
    if (!patch.displayName) {
      setProfileError("Display name is required.");
      return;
    }
    const result = await updateProfile(patch);
    if (!result.ok) {
      setProfileError("Could not update your profile.");
      return;
    }
    mutate(result.data);
    applyTheme(result.data.preferences.theme);
    setEditingProfile(false);
  };

  const onAvatar = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    try {
      const avatarUrl = await readAvatarDataUrl(file);
      await saveProfile(avatarUrl);
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "Could not read that image",
      );
    }
  };

  const enableNotify = async () => {
    if (typeof Notification === "undefined") {
      return;
    }
    const next = await Notification.requestPermission();
    setNotifyState(next);
  };

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

  const peopleMatches = () =>
    rankPeople(dmName(), people() ?? []).slice(0, 8);

  const onOpenDm: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (
    event,
  ) => {
    event.preventDefault();
    setError(null);
    const first = peopleMatches()[0];
    if (first) {
      await openPerson(first);
      return;
    }
    setError("No one on this server matches that search.");
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
    const peopleHits = query
      ? rankPeople(query, people() ?? [])
      : (people() ?? []);
    return { roomHits, peopleHits };
  };

  const openPerson = async (person: PublicProfile) => {
    const result = await openDm({ userId: person.id });
    if (result.ok) {
      setDmName("");
      setPaletteOpen(false);
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
          <Show
            when={editingProfile()}
            fallback={
              <button
                type="button"
                class="mt-2 text-left"
                onClick={openProfile}
              >
                <Show when={profile()?.avatarUrl}>
                  {(url) => (
                    <img
                      src={url()}
                      alt=""
                      class="mb-2 h-12 w-12 rounded-full object-cover"
                    />
                  )}
                </Show>
                <h1 class="text-2xl font-semibold">
                  {profileName(profile())}
                </h1>
                <p class="text-sm text-[var(--muted)]">
                  @{profileHandle(profile())}
                </p>
                <Show when={profile()?.status}>
                  {(status) => (
                    <p class="mt-1 text-sm text-[var(--muted)]">{status()}</p>
                  )}
                </Show>
                <p class="mt-1 text-xs text-[var(--accent)]">Edit profile</p>
              </button>
            }
          >
            <ProfileEditor
              displayName={displayDraft()}
              bio={bioDraft()}
              status={statusDraft()}
              theme={themeDraft()}
              visibility={visibilityDraft()}
              showOnline={onlineDraft()}
              avatarUrl={profile()?.avatarUrl}
              error={profileError()}
              onDisplayName={setDisplayDraft}
              onBio={setBioDraft}
              onStatus={setStatusDraft}
              onTheme={setThemeDraft}
              onVisibility={setVisibilityDraft}
              onShowOnline={setOnlineDraft}
              onAvatar={(url) => void saveProfile(url)}
              onUpload={(file) => void onAvatar(file)}
              onSave={() => void saveProfile()}
              onCancel={() => setEditingProfile(false)}
            />
          </Show>
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
                    <RoomRow room={room} />
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
                    <RoomRow room={room} />
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
          <PeopleSearch
            query={dmName()}
            error={error()}
            matches={peopleMatches()}
            onQuery={setDmName}
            onPick={(person) => void openPerson(person)}
            onSubmit={onOpenDm}
          />
          <Show when={error()}>
            <p class="text-sm text-red-300">{error()}</p>
          </Show>
        </div>
        <div class="flex items-center justify-between gap-2 border-t border-[var(--line)] px-4 py-4">
          <button
            type="button"
            class="text-sm text-[var(--muted)]"
            onClick={() => setPaletteOpen(true)}
          >
            Jump · Ctrl+K
          </button>
          <Show when={notifyState() === "default"}>
            <button
              type="button"
              class="text-sm text-[var(--accent)]"
              onClick={() => void enableNotify()}
            >
              Notify
            </button>
          </Show>
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
