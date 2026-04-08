/**
 * Sidebar — Navegação agrupada como no Power BI: visão executiva, PS / CC / Internação, financeiro.
 */
import React from 'react';
import {
  LayoutDashboard, Stethoscope, Scissors, ClipboardList,
  DollarSign, ChevronLeft, ShieldCheck
} from 'lucide-react';

const GROUPS = [
  {
    key: 'exec',
    label: 'Visão executiva',
    items: [
      { key: 'overview', label: 'Resumo geral', Icon: LayoutDashboard },
    ],
  },
  {
    key: 'assist',
    label: 'Operação assistencial',
    items: [
      { key: 'ps', label: 'Pronto Socorro (PS)', Icon: Stethoscope },
      { key: 'cirurgias', label: 'Centro Cirúrgico (CC)', Icon: Scissors },
      { key: 'internacoes', label: 'Internações / UTI', Icon: ClipboardList },
    ],
  },
  {
    key: 'adm',
    label: 'Administrativo',
    items: [
      { key: 'financeiro', label: 'Financeiro', Icon: DollarSign },
    ],
  },
];

const Sidebar = ({ activeSection, onNavigate, collapsed, onToggle }) => (
  <aside
    className={`${collapsed ? 'w-16' : 'w-60'} shrink-0 flex flex-col bg-slate-950 border-r border-slate-800
                transition-all duration-300 ease-in-out`}
  >
    <div className={`h-16 flex items-center border-b border-slate-800 ${collapsed ? 'justify-center px-0' : 'px-5 gap-3'}`}>
      <div className="w-8 h-8 bg-hospital-500 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-hospital-500/30">
        <ShieldCheck size={16} className="text-white" />
      </div>
      {!collapsed && (
        <span className="text-white font-bold text-base tracking-tight">
          MedSenior<span className="text-hospital-400">BI</span>
        </span>
      )}
    </div>

    <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
      {GROUPS.map((group) => (
        <div key={group.key}>
          {!collapsed && (
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">
              {group.label}
            </p>
          )}
          <div className="space-y-0.5">
            {group.items.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => onNavigate(key)}
                title={collapsed ? label : undefined}
                className={`w-full nav-item ${activeSection === key ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate text-left">{label}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>

    <button
      onClick={onToggle}
      className="h-12 flex items-center justify-center border-t border-slate-800 text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
    >
      <ChevronLeft size={16} className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
    </button>
  </aside>
);

export default Sidebar;
