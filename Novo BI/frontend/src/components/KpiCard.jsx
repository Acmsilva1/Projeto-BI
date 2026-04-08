/**
 * KpiCard.jsx — Card de métrica com delta + barra de tendência
 */
import React from 'react';
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';

const KpiCard = ({ label, value, suffix = '', delta = null, deltaLabel = 'vs 30d', accent = 'hospital', loading = false }) => {
  const isPos  = delta > 0;
  const isNeg  = delta < 0;
  const deltaStr = delta !== null ? `${isPos ? '+' : ''}${delta}%` : null;

  const accentMap = {
    hospital: 'border-hospital-500',
    emerald:  'border-emerald-500',
    rose:     'border-rose-500',
    amber:    'border-amber-500',
  };

  return (
    <div className={`kpi-card border-l-2 ${accentMap[accent] || accentMap.hospital} animate-fade-in-up`}>
      {loading ? (
        <div className="h-12 flex items-center">
          <Loader2 size={16} className="animate-spin text-slate-600" />
        </div>
      ) : (
        <>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-white tracking-tight">{value ?? '--'}</span>
            {suffix && <span className="text-xs font-semibold text-slate-400">{suffix}</span>}
          </div>
          {deltaStr !== null && (
            <div className="flex items-center gap-1 mt-1">
              {isPos  && <TrendingUp  size={12} className="text-emerald-400" />}
              {isNeg  && <TrendingDown size={12} className="text-rose-400" />}
              {!isPos && !isNeg && <Minus size={12} className="text-slate-500" />}
              <span className={`text-[10px] font-bold ${isPos ? 'text-emerald-400' : isNeg ? 'text-rose-400' : 'text-slate-500'}`}>
                {deltaStr}
              </span>
              <span className="text-[10px] text-slate-600">{deltaLabel}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default KpiCard;
