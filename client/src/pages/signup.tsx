import { A, useNavigate } from "@solidjs/router";
import { createSignal, type JSX } from "solid-js";
import { signup } from "../lib/auth-api.ts";

const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "");

const signupError = (status: number) =>
  status === 409 ? "That username is taken." : "Could not create the account.";

export const SignupPage = () => {
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
    const result = await signup({
      username: field(form, "username"),
      displayName: field(form, "displayName"),
      password: field(form, "password"),
    });
    setPending(false);
    if (!result.ok) {
      setError(signupError(result.status));
      return;
    }
    navigate("/app", { replace: true });
  };

  return (
    <main class="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <h1 class="text-3xl font-semibold">Create account</h1>
      <form class="flex flex-col gap-4" onSubmit={onSubmit}>
        <label class="flex flex-col gap-1 text-sm text-[var(--muted)]">
          Username
          <input
            name="username"
            autocomplete="username"
            required
            minLength={3}
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
            minLength={8}
            class="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
          />
        </label>
        {error() ? <p class="text-sm text-red-300">{error()}</p> : null}
        <button
          type="submit"
          disabled={pending()}
          class="rounded-lg bg-[var(--accent)] px-5 py-2.5 font-medium text-[var(--bg)] disabled:opacity-60"
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
};
