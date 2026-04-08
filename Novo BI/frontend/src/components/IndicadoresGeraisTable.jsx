import React from 'react';
import { Loader2 } from 'lucide-react';

function fmt(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('pt-BR').format(n);
}

function fmtPct(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Number(n).toFixed(2)}%`;
}

function fmtHoras(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(n)} h`;
}

/**
 * Tabela densa estilo PBI "Indicadores gerais" por unidade.
 */
export default function IndicadoresGeraisTable({ data, loading }) {
  const linhas = data?.linhas || [];
  const tot = data?.totais || {};

  return (
    <div className="card-premium overflow-hidden">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Indicadores gerais por unidade</h3>
      {loading ? (
        <div className="py-16 flex justify-center text-slate-600">
          <Loader2 size={28} className="animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wide">
                <th className="py-2 pr-3 pl-2 sticky left-0 bg-slate-900 z-10">Unidade</th>
                <th className="py-2 px-2 text-right">Reg.</th>
                <th className="py-2 px-2 text-right">Ocup. %</th>
                <th className="py-2 px-2 text-right">Pac. ativos</th>
                <th className="py-2 px-2 text-right">Cir. mês</th>
                <th className="py-2 px-2 text-right">Leitos disp.</th>
                <th className="py-2 px-2 text-right">Atend. PS</th>
                <th className="py-2 px-2 text-right">Intern.</th>
                <th className="py-2 px-2 text-right">% conv.</th>
                <th className="py-2 px-2 text-right">Tempo PS→int.</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((r, i) => (
                <tr key={i} className="border-b border-slate-800/80 hover:bg-slate-800/40">
                  <td className="py-2 pr-3 pl-2 text-slate-200 font-medium sticky left-0 bg-slate-900/95 max-w-[200px] truncate" title={r.unidade}>
                    {r.unidade}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-400">{r.regional}</td>
                  <td className="py-2 px-2 text-right text-emerald-400/90">{fmtPct(r.ocupacaoPct)}</td>
                  <td className="py-2 px-2 text-right text-slate-300">{fmt(r.pacientesAtivos)}</td>
                  <td className="py-2 px-2 text-right text-slate-300">{fmt(r.cirurgiasMes)}</td>
                  <td className="py-2 px-2 text-right text-slate-400">{fmt(r.leitosDisponiveis)}</td>
                  <td className="py-2 px-2 text-right text-slate-300">{fmt(r.atendimentosPs)}</td>
                  <td className="py-2 px-2 text-right text-slate-300">{fmt(r.internacoes)}</td>
                  <td className="py-2 px-2 text-right text-amber-400/90">{fmtPct(r.pctConversao)}</td>
                  <td className="py-2 px-2 text-right text-slate-300">{fmtHoras(r.tempoMedioPsInternacaoHoras)}</td>
                </tr>
              ))}
              <tr className="bg-slate-800/50 font-semibold border-t border-slate-700">
                <td className="py-3 pr-3 pl-2 sticky left-0 bg-slate-800 text-white">Total / média ponderada</td>
                <td className="py-3 px-2 text-right text-slate-500">—</td>
                <td className="py-3 px-2 text-right text-slate-500">—</td>
                <td className="py-3 px-2 text-right text-white">{fmt(tot.pacientesAtivos)}</td>
                <td className="py-3 px-2 text-right text-white">{fmt(tot.cirurgiasMes)}</td>
                <td className="py-3 px-2 text-right text-slate-500">—</td>
                <td className="py-3 px-2 text-right text-white">{fmt(tot.atendimentosPs)}</td>
                <td className="py-3 px-2 text-right text-white">{fmt(tot.internacoes)}</td>
                <td className="py-3 px-2 text-right text-amber-300">{fmtPct(tot.pctConversao)}</td>
                <td className="py-3 px-2 text-right text-slate-200">{fmtHoras(tot.tempoMedioPsInternacaoHoras)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
