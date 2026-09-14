import { expect, test } from "@playwright/test";
import { signup, uniqueUser } from "./helpers.ts";

test("signup then sign out", async ({ page }) => {
  const user = uniqueUser("user", "Test User");
  await signup(page, user);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "chat-refine" })).toBeVisible();
});

test("signin succeeds and rejected signin shows an error", async ({ page }) => {
  const user = uniqueUser("user", "Test User");
  await signup(page, user);
  await page.getByRole("button", { name: "Sign out" }).click();

  await page.goto("/login");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid username or password.")).toBeVisible();

  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: user.displayName })).toBeVisible();
});
