import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'hospital-bi-theme';

/** @type {readonly ['dark','light','dark-green','dark-blue']} */
export const THEMES = ['dark', 'light', 'dark-green', 'dark-blue'];

const ThemeContext = createContext(null);

function applyThemeClass(theme) {
  const root = document.documentElement;
  THEMES.forEach((t) => root.classList.remove(t));
  if (THEMES.includes(theme)) root.classList.add(theme);
}

/**
 * Alterna classes no &lt;html&gt; (.dark | .light | .dark-green | .dark-blue).
 * Persistência em localStorage — alinhado a css.md (orquestração de temas).
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return THEMES.includes(s) ? s : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    applyThemeClass(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const setTheme = useCallback((t) => {
    if (THEMES.includes(t)) setThemeState(t);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((cur) => THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, cycleTheme, themes: THEMES }),
    [theme, setTheme, cycleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  return ctx;
}
