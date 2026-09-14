import { expect, test, type Page } from "@playwright/test";

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

test("sidebar shows last message, unread, and server history", async ({
  browser,
}) => {
  const adaUser = uniqueUser("ada");
  const bobUser = uniqueUser("bob");
  const adaContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const ada = await adaContext.newPage();
  const bob = await bobContext.newPage();

  await signup(ada, adaUser);
  await signup(bob, bobUser);

  await ada.getByRole("link", { name: "general" }).click();
  const body = `inbox-${Date.now()}`;
  await ada.getByRole("textbox", { name: "Message", exact: true }).fill(body);
  await ada.getByRole("button", { name: "Send" }).click();
  await expect(ada.getByRole("main").getByText(body)).toBeVisible();

  await expect(
    bob.getByRole("link", { name: new RegExp(`${body} \\d+`) }),
  ).toBeVisible({
    timeout: 15_000,
  });

  await bob.getByRole("link", { name: /general/ }).click();
  await expect(bob.getByRole("main").getByText(body)).toBeVisible({
    timeout: 15_000,
  });

  await adaContext.close();
  await bobContext.close();
});

test("people search matches a display-name fragment", async ({ browser }) => {
  const adaUser = uniqueUser("ada");
  const bobUser = uniqueUser("bob");
  const adaContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const ada = await adaContext.newPage();
  const bob = await bobContext.newPage();
  await signup(ada, adaUser);
  await signup(bob, bobUser);
  const fragment = bobUser.displayName.split(" ")[1] ?? bobUser.username;
  await ada.getByLabel("Find people").fill(fragment);
  await expect(
    ada.getByRole("button", { name: new RegExp(bobUser.displayName) }),
  ).toBeVisible({ timeout: 10_000 });
  await adaContext.close();
  await bobContext.close();
});

test("profile display name can be edited", async ({ page }) => {
  const user = uniqueUser("ada");
  await signup(page, user);
  await page.getByRole("button", { name: /Edit profile/ }).click();
  await page.getByLabel("Display name").fill("Ada Prime");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Ada Prime" })).toBeVisible();
});

test("a file sent while alone is visible later", async ({ browser }) => {
  const adaUser = uniqueUser("ada");
  const bobUser = uniqueUser("bob");
  const adaContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const ada = await adaContext.newPage();
  const bob = await bobContext.newPage();

  await signup(ada, adaUser);
  await signup(bob, bobUser);

  await ada.getByRole("link", { name: "general" }).click();
  await expect(ada.getByRole("button", { name: "Attach", exact: true })).toBeVisible();
  const fileName = `note-${Date.now()}.txt`;
  await ada.getByLabel("Attach file").setInputFiles({
    name: fileName,
    mimeType: "text/plain",
    buffer: Buffer.from("shared-note"),
  });
  await ada.getByRole("button", { name: "Send" }).click();
  await expect(ada.getByRole("main").getByRole("link", { name: fileName })).toBeVisible({
    timeout: 15_000,
  });

  await bob.getByRole("link", { name: /general/ }).click();
  await expect(bob.getByRole("main").getByRole("link", { name: fileName })).toBeVisible({
    timeout: 15_000,
  });

  await adaContext.close();
  await bobContext.close();
});
