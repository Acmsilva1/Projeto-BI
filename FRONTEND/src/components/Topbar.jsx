/**
 * Topbar: cabecalho global com filtros.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { getApiV1Base, buildApiQuery } from '../utils/apiBase';

const REGIONAIS = [
  { value: '', label: 'Todas Regionais' },
  { value: 'ES', label: 'Espirito Santo' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'MG', label: 'Minas Gerais' },
];

const PERIODOS_DEFAULT = [
  { value: 7, label: 'Ultimos 7 dias (rapido)' },
  { value: 30, label: 'Ultimos 30 dias' },
  { value: 90, label: 'Ultimos 90 dias' },
  { value: 365, label: 'Ultimos 12 meses' },
  { value: 1095, label: 'Ultimos 3 anos' },
  { value: 366, label: 'Ano civil (jan-hoje)' },
];

const PERIODOS_GERENCIA = [
  { value: 7, label: 'Ultimos 7 dias (aperitivo)' },
  { value: 30, label: 'Ultimos 30 dias' },
  { value: 60, label: 'Ultimos 60 dias (cache quente)' },
];

const selectContrast =
  'max-w-[min(100%,14rem)] sm:max-w-[16rem] truncate rounded-lg border border-slate-300 bg-white px-2.5 py-2 ' +
  'text-xs font-medium text-slate-900 shadow-sm outline-none cursor-pointer ' +
  '[color-scheme:light] ' +
  'focus:border-hospital-600 focus:ring-2 focus:ring-hospital-500/35 ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

const Topbar = ({ activeSection, filters, onFilterChange, onRefresh, sectionLabel }) => {
  const [clock, setClock] = useState('');
  const [unidades, setUnidades] = useState([]);
  const [unidadesReady, setUnidadesReady] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).replace(',', ' -'));
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const unidadesEndpoint = activeSection === 'gerencia' ? 'gerencia/unidades-ps' : 'kpi/unidades';

  useEffect(() => {
    setUnidadesReady(false);
    const q = buildApiQuery(filters.regional ? { regional: filters.regional } : {});
    const ac = new AbortController();
    fetch(`${getApiV1Base()}/${unidadesEndpoint}${q}`, { signal: ac.signal })
      .then((r) => r.text())
      .then((raw) => {
        if (ac.signal.aborted) return;
        try {
          const j = raw ? JSON.parse(raw) : {};
          if (j.ok && Array.isArray(j.data)) setUnidades(j.data);
          else setUnidades([]);
        } catch {
          setUnidades([]);
        }
      })
      .catch(() => {
        if (!ac.signal.aborted) setUnidades([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setUnidadesReady(true);
      });
    return () => ac.abort();
  }, [filters.regional, unidadesEndpoint]);

  const unidadesSorted = useMemo(() => {
    return [...unidades].sort((a, b) => {
      const na = parseInt(String(a.codigo ?? a.unidadeId ?? ''), 10);
      const nb = parseInt(String(b.codigo ?? b.unidadeId ?? ''), 10);
      if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
      const ra = String(a.regional || '');
      const rb = String(b.regional || '');
      if (ra !== rb) return ra.localeCompare(rb, 'pt-BR');
      return String(a.unidadeNome || '').localeCompare(String(b.unidadeNome || ''), 'pt-BR');
    });
  }, [unidades]);

  const labelUnidadeOption = (u) => {
    const nome = String(u.unidadeNome || '').trim();
    const reg = String(u.regional || '').trim();
    const cod = u.codigo != null && String(u.codigo).trim() !== '' ? String(u.codigo).padStart(3, '0') : '';
    if (cod && nome && reg) return `${cod} - ${nome}_${reg}`;
    if (reg && nome) return `${reg} - ${nome}`;
    return nome || reg || String(u.unidadeId || '');
  };

  useEffect(() => {
    if (!unidadesReady || !filters.unidade) return;
    const ok = unidadesSorted.some((u) => u.unidadeId === filters.unidade);
    if (!ok) onFilterChange({ unidade: '' });
  }, [unidadesReady, unidadesSorted, filters.unidade, onFilterChange]);

  useEffect(() => {
    if (activeSection !== 'gerencia') return;
    const p = Number(filters.period);
    if (!Number.isFinite(p) || p <= 0) {
      onFilterChange({ period: 7 });
      return;
    }
    if (p > 60) onFilterChange({ period: 60 });
  }, [activeSection, filters.period, onFilterChange]);

  const periodOptions = activeSection === 'gerencia' ? PERIODOS_GERENCIA : PERIODOS_DEFAULT;

  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-4 sm:px-6 bg-app-surface/80 border-b border-app-border backdrop-blur-sm z-10 shadow-[inset_0_-1px_0_0_color-mix(in_srgb,var(--primary)_08%,transparent)]">
      <div className="flex flex-col min-w-0 gap-0.5">
        <h1 className="text-base font-bold tracking-tight text-app-fg truncate sm:text-lg">{sectionLabel}</h1>
        <p className="text-xs text-app-muted font-mono tabular-nums">{clock}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div
          className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-app-border bg-app-elevated/60 px-2 py-1.5 sm:px-3 [color-scheme:light]"
          role="group"
          aria-label="Filtros do painel"
        >
          <select
            className={selectContrast}
            aria-label="Filtrar por regional"
            value={filters.regional}
            onChange={(e) => onFilterChange({ regional: e.target.value, unidade: '' })}
          >
            {REGIONAIS.map((r) => (
              <option key={r.value || 'all'} value={r.value} className="bg-white text-slate-900">
                {r.label}
              </option>
            ))}
          </select>

          <div className="hidden sm:block w-px h-6 bg-app-border shrink-0" aria-hidden />

          <select
            className={selectContrast}
            style={{ maxWidth: 'min(100%, 26rem)' }}
            aria-label="Filtrar por unidade"
            value={filters.unidade}
            onChange={(e) => onFilterChange({ unidade: e.target.value })}
            title={
              (() => {
                const u = unidadesSorted.find((x) => x.unidadeId === filters.unidade);
                return u ? labelUnidadeOption(u) : '';
              })()
            }
          >
            <option value="" className="bg-white text-slate-900">
              Todas as unidades
            </option>
            {unidadesSorted.map((u) => (
              <option key={u.unidadeId} value={u.unidadeId} className="bg-white text-slate-900" title={labelUnidadeOption(u)}>
                {labelUnidadeOption(u)}
              </option>
            ))}
          </select>

          <div className="hidden sm:block w-px h-6 bg-app-border shrink-0" aria-hidden />

          <select
            className={selectContrast}
            aria-label="Periodo"
            value={filters.period}
            onChange={(e) => onFilterChange({ period: Number(e.target.value) })}
          >
            {periodOptions.map((p) => (
              <option key={p.value} value={p.value} className="bg-white text-slate-900">
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="app-transition flex h-9 w-9 items-center justify-center rounded-lg bg-pipeline-live text-lg leading-none text-slate-900 hover:brightness-110 active:scale-[0.97] shadow-md [box-shadow:0_2px_14px_color-mix(in_srgb,var(--dash-live)_40%,transparent)]"
          aria-label="Atualizar dados"
          title="Atualizar dados"
        >
          <span aria-hidden>🔄</span>
        </button>
      </div>
    </header>
  );
};

export default Topbar;

