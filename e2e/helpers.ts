import { expect, type Page } from "@playwright/test";

export type TestUser = {
  username: string;
  displayName: string;
  password: string;
};

export const uniqueUser = (name = "user", displayName?: string): TestUser => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    username: `${name}${suffix}`.slice(0, 32),
    displayName: (displayName ?? `${name} ${suffix}`).slice(0, 32),
    password: "sufficient",
  };
};

export const signup = async (page: Page, user: TestUser) => {
  await page.goto("/signup");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Display name").fill(user.displayName);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: user.displayName })).toBeVisible();
};

export const connectedStatus = /Connected · \d+ peers?/;

export const createPublicRoom = async (page: Page, title: string) => {
  await page.getByLabel("New channel").fill(title);
  await page.getByRole("button", { name: "Create room" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible({
    timeout: 10_000,
  });
};

export const joinListedRoom = async (page: Page, title: string) => {
  await page.getByRole("button", { name: `Join ${title}` }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible({
    timeout: 10_000,
  });
};

export const sharePublicRoom = async (
  host: Page,
  guest: Page,
  title: string,
) => {
  await createPublicRoom(host, title);
  await guest.goto("/app");
  await joinListedRoom(guest, title);
};
