import { expect, test } from "@playwright/test";

test("landing offers signup and signin", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "chat-refine" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create account" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});
