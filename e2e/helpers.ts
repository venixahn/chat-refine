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
