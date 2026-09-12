import { expect, test } from "@playwright/test";
import { devices } from "@playwright/test";

const uniqueUser = () => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    username: `mob${suffix}`.slice(0, 32),
    displayName: "Mobile User",
    password: "sufficient",
  };
};

test.use({ ...devices["Pixel 7"], channel: "msedge" });

test("mobile stacks rooms then the thread", async ({ page }) => {
  const user = uniqueUser();
  await page.goto("/signup");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Display name").fill(user.displayName);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: user.displayName })).toBeVisible();
  await expect(page.getByRole("link", { name: "general" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pick a room" })).toHaveCount(0);

  await page.getByRole("link", { name: "general" }).click();
  await expect(page.getByRole("heading", { name: "general" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Rooms" })).toBeVisible();
  await page.getByRole("link", { name: "Rooms" }).click();
  await expect(page.getByRole("link", { name: "general" })).toBeVisible();
});
