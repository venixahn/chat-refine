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

test("two members exchange a p2p text message", async ({ browser }) => {
  const adaUser = uniqueUser("ada");
  const bobUser = uniqueUser("bob");
  const adaContext = await browser.newContext();
  const bobContext = await browser.newContext();
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

  const body = `hello-p2p-${Date.now()}`;
  await ada.getByRole("textbox", { name: "Message", exact: true }).fill(body);
  await ada.getByRole("button", { name: "Send" }).click();
  await expect(ada.getByRole("main").getByText(body)).toBeVisible();
  await expect(bob.getByRole("main").getByText(body)).toBeVisible({
    timeout: 15_000,
  });

  const marked = `note-${Date.now()}`;
  await ada.getByRole("textbox", { name: "Message", exact: true }).fill(`**${marked}**`);
  await ada.getByRole("button", { name: "Send" }).click();
  await expect(ada.getByRole("main").locator("strong", { hasText: marked })).toBeVisible();
  await expect(bob.getByRole("main").locator("strong", { hasText: marked })).toBeVisible({
    timeout: 15_000,
  });

  await adaContext.close();
  await bobContext.close();
});

test("an open room shows text from history when activity arrives", async ({
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
  await bob.getByRole("link", { name: "general" }).click();
  await expect(ada.getByRole("textbox", { name: "Message", exact: true })).toBeVisible();
  await expect(bob.getByRole("textbox", { name: "Message", exact: true })).toBeVisible();

  const body = `hello-room-${Date.now()}`;
  await ada.getByRole("textbox", { name: "Message", exact: true }).fill(body);
  await ada.getByRole("button", { name: "Send" }).click();
  await expect(ada.getByRole("main").getByText(body)).toBeVisible();
  await expect(bob.getByRole("main").getByText(body)).toBeVisible({
    timeout: 15_000,
  });

  await adaContext.close();
  await bobContext.close();
});
