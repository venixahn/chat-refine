import { expect, test } from "@playwright/test";
import { sharePublicRoom, signup, uniqueUser } from "./helpers.ts";

test("an open thread jumps to unread, searches, and edits", async ({
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

  const roomName = `thrd${Date.now()}`.slice(0, 20);
  await sharePublicRoom(ada, bob, roomName);
  await expect(ada.getByLabel(`${adaUser.displayName} here`)).toBeVisible({
    timeout: 20_000,
  });
  await expect(ada.getByLabel(`${bobUser.displayName} here`)).toBeVisible({
    timeout: 20_000,
  });
  await expect(ada.getByText(/Waiting for peers|Connected ·/)).toBeVisible({
    timeout: 20_000,
  });
  const body = `unread-${Date.now()}`;
  await ada.getByRole("textbox", { name: "Message", exact: true }).fill(body);
  await ada.getByRole("button", { name: "Send" }).click();
  await expect(ada.getByRole("main").getByText(body)).toBeVisible();

  await expect(bob.getByText("New messages")).toBeVisible({ timeout: 15_000 });
  await expect(bob.getByRole("main").getByText(body)).toBeVisible();

  await bob.getByLabel("Search messages").fill(body);
  await expect(bob.getByRole("main").getByText(body)).toBeVisible();

  await ada.getByRole("main").getByRole("button", { name: "Edit", exact: true }).click();
  const edited = `${body}-fixed`;
  await ada.getByLabel("Edit message").fill(edited);
  await ada.getByRole("main").getByRole("button", { name: "Save" }).click();
  await expect(ada.getByRole("main").getByText(edited)).toBeVisible({
    timeout: 10_000,
  });
  await expect(ada.getByRole("main").getByText("(edited)").first()).toBeVisible();

  await adaContext.close();
  await bobContext.close();
});

test("a private channel can be invited, given a topic, and muted", async ({
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

  await ada.getByLabel("Private").check();
  const roomName = `quiet${Date.now()}`.slice(0, 20);
  await ada.getByLabel("New channel").fill(roomName);
  await ada.getByRole("button", { name: "Create room" }).click();
  await expect(ada.getByRole("heading", { name: roomName })).toBeVisible({
    timeout: 10_000,
  });
  await expect(bob.getByRole("button", { name: `Join ${roomName}` })).toHaveCount(0);

  await ada.getByLabel("Invite").fill(bobUser.username);
  await ada.getByRole("button", { name: "Invite" }).click();
  await expect(ada.getByLabel("Invite")).toHaveValue("");

  await bob.goto("/app");
  await expect(bob.getByRole("link", { name: roomName })).toBeVisible({
    timeout: 15_000,
  });

  await ada.getByLabel("Topic").fill("Need to know");
  await ada.getByLabel("Topic").blur();
  await expect(ada.getByLabel("Topic")).toHaveValue("Need to know");

  await ada.getByRole("button", { name: "Mute channel" }).click();
  await expect(ada.getByRole("button", { name: "Unmute channel" })).toBeVisible();

  await adaContext.close();
  await bobContext.close();
});
