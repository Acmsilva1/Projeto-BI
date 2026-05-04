export const appThemes = ["theme-dark", "theme-light", "theme-green", "theme-blue"] as const;

export type AppTheme = (typeof appThemes)[number];

export const defaultTheme: AppTheme = "theme-dark";

export function applyTheme(theme: AppTheme): void {
  const root = document.documentElement;
  for (const value of appThemes) {
    root.classList.remove(value);
  }
  root.classList.add(theme);
}

