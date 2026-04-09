/**
 * Topbar.jsx — Cabeçalho global com filtros (regional, unidade, período)
 * Selects com color-scheme claro + fundo branco para contraste no menu nativo.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { getApiV1Base, buildApiQuery } from '../utils/apiBase';

const REGIONAIS = [
  { value: '', label: 'Todas Regionais' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'MG', label: 'Minas Gerais' },
];

const PERIODOS = [
  { value: 30, label: 'Últimos 30 dias' },
  { value: 90, label: 'Últimos 90 dias' },
  { value: 365, label: 'Ano Atual' },
];

/** Estilo alto contraste: lista nativa legível em SO com tema escuro */
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
      setClock(now.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).replace(',', ' —'));
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const unidadesEndpoint =
    activeSection === 'gerencia' ? 'gerencia/unidades-ps' : 'kpi/unidades';

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
      const ra = String(a.regional || '');
      const rb = String(b.regional || '');
      if (ra !== rb) return ra.localeCompare(rb, 'pt-BR');
      return String(a.unidadeNome || '').localeCompare(String(b.unidadeNome || ''), 'pt-BR');
    });
  }, [unidades]);

  const labelUnidadeOption = (u) => {
    const uf = String(u.regional || '').trim();
    const nome = String(u.unidadeNome || '').trim();
    if (uf && nome) return `${uf} - ${nome}`;
    return nome || uf || String(u.unidadeId || '');
  };

  useEffect(() => {
    if (!unidadesReady || !filters.unidade) return;
    const ok = unidadesSorted.some((u) => u.unidadeId === filters.unidade);
    if (!ok) onFilterChange({ unidade: '' });
  }, [unidadesReady, unidadesSorted, filters.unidade, onFilterChange]);

  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-6 bg-slate-900/60 border-b border-slate-800 backdrop-blur-sm z-10">
      <div className="flex flex-col min-w-0">
        <h1 className="text-sm font-bold text-white truncate">{sectionLabel}</h1>
        <p className="text-[10px] text-slate-500 font-mono">{clock}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div
          className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-slate-700/90 bg-slate-800/50 px-2 py-1.5 sm:px-3 [color-scheme:light]"
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

          <div className="hidden sm:block w-px h-6 bg-slate-600 shrink-0" aria-hidden />

          <select
            className={selectContrast}
            style={{ maxWidth: 'min(100%, 18rem)' }}
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
              <option
                key={u.unidadeId}
                value={u.unidadeId}
                className="bg-white text-slate-900"
                title={labelUnidadeOption(u)}
              >
                {labelUnidadeOption(u)}
              </option>
            ))}
          </select>

          <div className="hidden sm:block w-px h-6 bg-slate-600 shrink-0" aria-hidden />

          <select
            className={selectContrast}
            aria-label="Período"
            value={filters.period}
            onChange={(e) => onFilterChange({ period: Number(e.target.value) })}
          >
            {PERIODOS.map((p) => (
              <option key={p.value} value={p.value} className="bg-white text-slate-900">
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="p-2 rounded-lg bg-hospital-500 hover:bg-hospital-600 text-white transition-all active:scale-90 shadow-md shadow-hospital-500/30"
          aria-label="Atualizar dados"
        >
          <RefreshCw size={15} />
        </button>
      </div>
    </header>
  );
};

export default Topbar;
