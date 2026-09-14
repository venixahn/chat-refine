import { expect, test, type BrowserContextOptions, type Page } from "@playwright/test";

const uniqueUser = (name: string) => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    username: `${name}${suffix}`.slice(0, 32),
    displayName: `${name} ${suffix}`.slice(0, 32),
    password: "sufficient",
  };
};

const signup = async (
  page: Page,
  user: { username: string; displayName: string; password: string },
) => {
  await page.goto("/signup");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Display name").fill(user.displayName);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: user.displayName })).toBeVisible();
};

test("two members join a P2P call", async ({ browser }) => {
  test.setTimeout(90_000);
  const adaUser = uniqueUser("ada");
  const bobUser = uniqueUser("bob");
  const options: BrowserContextOptions = {
    permissions: ["camera", "microphone"],
  };
  const adaContext = await browser.newContext(options);
  const bobContext = await browser.newContext(options);
  const ada = await adaContext.newPage();
  const bob = await bobContext.newPage();

  await signup(ada, adaUser);
  await signup(bob, bobUser);

  await ada.getByRole("link", { name: "general" }).click();
  await bob.getByRole("link", { name: "general" }).click();
  await expect(ada.getByText(/Connected · 1 peer/)).toBeVisible({
    timeout: 20_000,
  });
  await expect(bob.getByText(/Connected · 1 peer/)).toBeVisible({
    timeout: 20_000,
  });

  await ada.getByRole("button", { name: "Join call" }).click();
  await expect(ada.getByLabel("You")).toBeVisible({ timeout: 15_000 });
  await bob.getByRole("button", { name: "Join call" }).click();
  await expect(bob.getByLabel("You")).toBeVisible({ timeout: 15_000 });

  await expect(ada.getByLabel(bobUser.displayName)).toBeVisible({
    timeout: 20_000,
  });
  await expect(bob.getByLabel(adaUser.displayName)).toBeVisible({
    timeout: 20_000,
  });
const remotePlaying = (page: Page, name: string) =>
  page.getByLabel(name).evaluate((el: HTMLVideoElement) => {
    const stream = el.srcObject as MediaStream | null;
    const live = Boolean(
      stream?.getVideoTracks().some((track) => track.readyState === "live"),
    );
    return live && !el.paused;
  });
  await expect
    .poll(() => remotePlaying(ada, bobUser.displayName), { timeout: 20_000 })
    .toBe(true);
  await expect
    .poll(() => remotePlaying(bob, adaUser.displayName), { timeout: 20_000 })
    .toBe(true);

  await ada.getByRole("button", { name: "Mute" }).click();
  await expect(ada.getByRole("button", { name: "Unmute" })).toBeVisible();
  await ada.getByRole("button", { name: "Leave call" }).click();
  await expect(ada.getByRole("button", { name: "Join call" })).toBeVisible();

  await adaContext.close();
  await bobContext.close();
});
