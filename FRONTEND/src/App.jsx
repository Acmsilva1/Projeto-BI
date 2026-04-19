/**
 * App.jsx — Shell principal da aplicação
 * Gerencia estado global de filtros, navegação e status da API.
 */
import React, { useState, useCallback, Suspense, lazy } from 'react';
import Sidebar from './components/Sidebar';
import Topbar  from './components/Topbar';
import OverviewSection from './components/sections/OverviewSection';

const PsSection         = lazy(() => import('./components/sections/PsSection'));
const CirurgiasSection  = lazy(() => import('./components/sections/CirurgiasSection'));
const InternacoesSection= lazy(() => import('./components/sections/InternacoesSection'));

const SECTION_LABELS = {
  gerencia:    'Gerência',
  ps:          'Pronto Socorro',
  cirurgias:   'Centro Cirúrgico',
  internacoes: 'Internação',
};

const SECTIONS = {
  gerencia:    OverviewSection,
  ps:          PsSection,
  cirurgias:   CirurgiasSection,
  internacoes: InternacoesSection,
};

const SectionLoader = () => (
  <div className="flex-1 flex min-h-[12rem] items-center justify-center text-app-muted">
    <div className="flex items-center gap-2" role="status" aria-label="Carregando módulo">
      <span className="state-loading-dot [animation-delay:0ms]" />
      <span className="state-loading-dot [animation-delay:150ms]" />
      <span className="state-loading-dot [animation-delay:300ms]" />
    </div>
  </div>
);

export default function App() {
  const [section,   setSection]   = useState('gerencia');
  const [collapsed, setCollapsed] = useState(false);
  const [filters, setFilters] = useState({ period: 1, regional: '', unidade: '' });

  const handleFilterChange = useCallback((patch) => {
    setFilters((f) => {
      const next = { ...f, ...patch };
      if (
        String(next.period) === String(f.period) &&
        String(next.regional ?? '') === String(f.regional ?? '') &&
        String(next.unidade ?? '') === String(f.unidade ?? '')
      ) {
        return f;
      }
      return next;
    });
  }, []);

  const ActiveSection = SECTIONS[section] || OverviewSection;

  return (
    <div className="flex h-screen overflow-hidden bg-app-bg text-app-fg animate-fade-in-up">
      <Sidebar
        activeSection={section}
        onNavigate={setSection}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          activeSection={section}
          sectionLabel={SECTION_LABELS[section]}
          filters={filters}
          onFilterChange={handleFilterChange}
        />

        {/* Dashboard Scroll */}
        <main className="flex-1 overflow-y-auto p-6">
          <Suspense fallback={<SectionLoader />}>
            <ActiveSection key={section} filters={filters} />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
