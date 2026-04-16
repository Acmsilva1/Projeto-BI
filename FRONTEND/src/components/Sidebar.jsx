/**
 * Sidebar — Navegação principal (lista única; título da área só no Topbar).
 */
import React from 'react';
import ThemeSwitcher from './ThemeSwitcher';

const NAV = [
  { key: 'gerencia', label: 'Gerência', emoji: '📊' },
  { key: 'ps', label: 'Pronto Socorro', emoji: '🚑' },
  { key: 'cirurgias', label: 'Centro Cirúrgico', emoji: '✂️' },
  { key: 'internacoes', label: 'Internação', emoji: '🛏️' },
];

const Sidebar = ({ activeSection, onNavigate, collapsed, onToggle }) => (
  <aside
    className={`${collapsed ? 'w-16' : 'w-60'} app-transition shrink-0 flex flex-col bg-app-surface border-r border-app-border ease-in-out [transition-property:width] [transition-duration:280ms] motion-reduce:transition-none`}
  >
    <div className={`h-16 flex items-center border-b border-app-border ${collapsed ? 'justify-center px-0' : 'px-5 gap-3'}`}>
      <div className="app-transition flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--primary)] text-lg leading-none text-white shadow-lg ring-2 ring-[color:var(--primary)]/30">
        <span aria-hidden>🛡️</span>
      </div>
      {!collapsed && (
        <span className="text-app-fg font-bold text-lg tracking-tight">
          MedSenior<span className="text-[color:var(--primary)]">BI</span>
        </span>
      )}
    </div>

    <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
      {NAV.map(({ key, label, emoji }) => (
        <button
          key={key}
          type="button"
          onClick={() => onNavigate(key)}
          title={collapsed ? label : undefined}
          className={`w-full nav-item ${activeSection === key ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
        >
          <span className="shrink-0 text-lg leading-none" aria-hidden>
            {emoji}
          </span>
          {!collapsed && <span className="truncate text-left">{label}</span>}
        </button>
      ))}
    </nav>

    <ThemeSwitcher collapsed={collapsed} />

    <button
      type="button"
      onClick={onToggle}
      className="app-transition h-12 flex items-center justify-center border-t border-app-border text-app-muted hover:text-app-fg hover:bg-app-elevated"
    >
      <span className="text-base leading-none" aria-hidden title={collapsed ? 'Expandir menu' : 'Recolher menu'}>
        {collapsed ? '▶️' : '◀️'}
      </span>
    </button>
  </aside>
);

export default Sidebar;
