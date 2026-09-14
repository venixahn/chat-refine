import type { UserPreferences } from "@chat-refine/shared";

export const resolveTheme = (
  theme: UserPreferences["theme"],
): "dark" | "light" => {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  return theme;
};

export const applyTheme = (theme: UserPreferences["theme"]): void => {
  document.documentElement.dataset.theme = resolveTheme(theme);
};
