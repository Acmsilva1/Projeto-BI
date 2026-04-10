import React from 'react';
import { THEMES, useTheme } from '../context/ThemeContext';

/** Rótulo curto na UI; `hint` no title para contexto (Geral / PS / Leitos). */
const META = {
  dark: { label: 'Escuro', emoji: '🌙', hint: 'Geral — tema escuro' },
  light: { label: 'Claro', emoji: '☀️', hint: 'Geral — tema claro' },
  'dark-green': { label: 'Verde', emoji: '🌿', hint: 'PS — tons verdes' },
  'dark-blue': { label: 'Azul', emoji: '💧', hint: 'Leitos — tons azuis' },
};

/**
 * Controle de tema visual (pipeline / telas de comando) — css.md §2.
 */
export default function ThemeSwitcher({ collapsed }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={`border-t border-app-border px-2 py-2 ${collapsed ? 'flex flex-col items-center gap-1' : 'grid grid-cols-2 gap-1'}`}
      role="group"
      aria-label="Tema da interface"
    >
      {THEMES.map((key) => {
        const { label, emoji, hint } = META[key];
        const on = theme === key;
        return (
          <button
            key={key}
            type="button"
            title={hint}
            aria-label={`Tema ${label}`}
            onClick={() => setTheme(key)}
            className={`app-transition flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-semibold ${
              collapsed ? 'w-10 px-0' : 'px-2'
            } ${
              on
                ? 'border text-app-fg shadow-sm [border-color:color-mix(in_srgb,var(--primary)_55%,var(--app-border))] [background:color-mix(in_srgb,var(--primary)_14%,var(--app-elevated))] [color:var(--app-fg)]'
                : 'border border-transparent text-app-muted hover:border-app-border hover:bg-app-elevated hover:text-app-fg'
            }`}
          >
            <span className={`shrink-0 leading-none ${collapsed ? 'text-base' : 'text-sm'}`} aria-hidden>
              {emoji}
            </span>
            {!collapsed && <span className="truncate">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
