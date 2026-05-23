export type ThemeMode = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "kanban-agent.theme-mode";

export const loadThemeMode = (): ThemeMode => {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "dark";
};

export const saveThemeMode = (mode: ThemeMode): void => {
  window.localStorage.setItem(THEME_STORAGE_KEY, mode);
};

export const resolveThemeMode = (mode: ThemeMode): "light" | "dark" => {
  if (mode !== "system") {
    return mode;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
};
