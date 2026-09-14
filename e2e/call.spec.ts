import { expect, test, type BrowserContextOptions, type Page } from "@playwright/test";
import { signup, uniqueUser } from "./helpers.ts";

const remotePlaying = (page: Page, name: string) =>
  page.locator(`video[aria-label="${name}"]`).evaluate((el: HTMLVideoElement) => {
    const stream = el.srcObject as MediaStream | null;
    const live = Boolean(
      stream?.getVideoTracks().some((track) => track.readyState === "live"),
    );
    return live && !el.paused;
  });

const joinCall = async (page: Page) => {
  await page.getByRole("button", { name: "Join call" }).click();
  await expect(page.getByLabel("You")).toBeVisible({ timeout: 15_000 });
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

  await joinCall(ada);
  await joinCall(bob);
  await expect(ada.getByLabel(bobUser.displayName)).toBeVisible({
    timeout: 20_000,
  });
  await expect(bob.getByLabel(adaUser.displayName)).toBeVisible({
    timeout: 20_000,
  });
  await expect
    .poll(() => remotePlaying(ada, bobUser.displayName), { timeout: 20_000 })
    .toBe(true);
  await expect
    .poll(() => remotePlaying(bob, adaUser.displayName), { timeout: 20_000 })
    .toBe(true);

  await ada.getByRole("button", { name: "Mute", exact: true }).click();
  await expect(ada.getByRole("button", { name: "Unmute", exact: true })).toBeVisible();
  await ada.getByRole("button", { name: "Leave call" }).click();
  await expect(ada.getByRole("button", { name: "Join call" })).toBeVisible();

  await adaContext.close();
  await bobContext.close();
});
