/**
 * App.jsx — Shell principal da aplicação
 * Gerencia estado global de filtros, navegação e status da API.
 */
import React, { useState, useCallback, Suspense, lazy } from 'react';
import Sidebar from './components/Sidebar';
import Topbar  from './components/Topbar';

// Lazy-load das seções → cada bundle só carrega quando necessário
const OverviewSection   = lazy(() => import('./components/sections/OverviewSection'));
const PsSection         = lazy(() => import('./components/sections/PsSection'));
const CirurgiasSection  = lazy(() => import('./components/sections/CirurgiasSection'));
const InternacoesSection= lazy(() => import('./components/sections/InternacoesSection'));
const FinanceiroSection = lazy(() => import('./components/sections/FinanceiroSection'));

const SECTION_LABELS = {
  overview:    'Resumo geral',
  ps:          'Pronto Socorro (PS)',
  cirurgias:   'Centro Cirúrgico (CC)',
  internacoes: 'Internações / UTI',
  financeiro:  'Financeiro',
};

const SECTIONS = {
  overview:    OverviewSection,
  ps:          PsSection,
  cirurgias:   CirurgiasSection,
  internacoes: InternacoesSection,
  financeiro:  FinanceiroSection,
};

const SectionLoader = () => (
  <div className="flex-1 flex items-center justify-center text-slate-700">
    <div className="flex items-center gap-2">
      <span className="h-4 w-4 rounded-full bg-hospital-500 animate-bounce [animation-delay:0ms]" />
      <span className="h-4 w-4 rounded-full bg-hospital-500 animate-bounce [animation-delay:150ms]" />
      <span className="h-4 w-4 rounded-full bg-hospital-500 animate-bounce [animation-delay:300ms]" />
    </div>
  </div>
);

export default function App() {
  const [section,   setSection]   = useState('overview');
  const [collapsed, setCollapsed] = useState(false);
  const [apiOnline, setApiOnline] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState({ period: 30, regional: '', unidade: '' });

  const handleFilterChange = useCallback((patch) => {
    setFilters(f => ({ ...f, ...patch }));
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const ActiveSection = SECTIONS[section] || OverviewSection;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      <Sidebar
        activeSection={section}
        onNavigate={setSection}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          sectionLabel={SECTION_LABELS[section]}
          filters={filters}
          onFilterChange={handleFilterChange}
          onRefresh={handleRefresh}
          apiOnline={apiOnline}
        />

        {/* Dashboard Scroll */}
        <main className="flex-1 overflow-y-auto p-6">
          <Suspense fallback={<SectionLoader />}>
            <ActiveSection
              key={`${section}-${refreshKey}`}
              filters={filters}
            />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
