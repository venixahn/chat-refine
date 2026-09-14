import { devices, expect, test } from "@playwright/test";
import { signup, uniqueUser } from "./helpers.ts";

test.use({ ...devices["Pixel 7"], channel: "msedge" });

test("mobile stacks rooms then the thread", async ({ page }) => {
  const user = uniqueUser("mob", "Mobile User");
  await signup(page, user);
  await expect(page.getByRole("link", { name: "general" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pick a room" })).toHaveCount(0);

  await page.getByRole("link", { name: "general" }).click();
  await expect(page.getByRole("heading", { name: "general" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Rooms" })).toBeVisible();
  await page.getByRole("link", { name: "Rooms" }).click();
  await expect(page.getByRole("link", { name: "general" })).toBeVisible();
});
