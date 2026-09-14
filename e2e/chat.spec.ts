import { expect, test } from "@playwright/test";
import { connectedStatus, sharePublicRoom, signup, uniqueUser } from "./helpers.ts";

test("two members exchange a p2p text message", async ({ browser }) => {
  test.setTimeout(60_000);
  const adaUser = uniqueUser("ada");
  const bobUser = uniqueUser("bob");
  const adaContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const ada = await adaContext.newPage();
  const bob = await bobContext.newPage();

  await signup(ada, adaUser);
  await signup(bob, bobUser);

  await sharePublicRoom(ada, bob, `chat${Date.now()}`.slice(0, 20));

  await expect(ada.getByText(connectedStatus)).toBeVisible({
    timeout: 20_000,
  });
  await expect(bob.getByText(connectedStatus)).toBeVisible({
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
  test.setTimeout(60_000);
  const adaUser = uniqueUser("ada");
  const bobUser = uniqueUser("bob");
  const adaContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const ada = await adaContext.newPage();
  const bob = await bobContext.newPage();

  await signup(ada, adaUser);
  await signup(bob, bobUser);

  await sharePublicRoom(ada, bob, `hist${Date.now()}`.slice(0, 20));
  await expect(ada.getByText(/Waiting for peers|Connecting peers|Connected ·/)).toBeVisible({
    timeout: 20_000,
  });
  await expect(bob.getByText(/Waiting for peers|Connecting peers|Connected ·/)).toBeVisible({
    timeout: 20_000,
  });

  const body = `hello-room-${Date.now()}`;
  await ada.getByRole("textbox", { name: "Message", exact: true }).fill(body);
  await ada.getByRole("button", { name: "Send" }).click();
  await expect(ada.getByRole("main").getByText(body)).toBeVisible({
    timeout: 15_000,
  });
  await expect(bob.getByRole("main").getByText(body)).toBeVisible({
    timeout: 15_000,
  });

  await adaContext.close();
  await bobContext.close();
});
