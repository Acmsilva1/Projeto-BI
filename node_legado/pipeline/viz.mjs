/**
 * Pipeline de visualização (leve, no cliente).
 *
 * ETL e números “pesados”: PostgreSQL (views já agregadas). O Node só repassa JSON.
 * Este arquivo só infere qual modelo ECharts usar a partir do formato do payload —
 * custo trivial de CPU; não substitui agregação no banco.
 */

const RE_ISO = /^\d{4}-\d{2}(-\d{2})?/;
const RE_PT_MONTH = /^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i;
const RE_QUARTER = /^q[1-4]\s*[/\s-]?\d{2,4}$/i;
const RE_DAY = /^\d{1,2}[/-]\d{1,2}/;

export function isLikelyTimeCategories(labels) {
  if (!Array.isArray(labels) || labels.length < 2) return false;
  let hits = 0;
  for (const l of labels) {
    const s = String(l ?? '').trim();
    if (RE_ISO.test(s) || RE_PT_MONTH.test(s) || RE_QUARTER.test(s) || RE_DAY.test(s)) hits += 1;
    if (/semana|semanal|dia\s*\d|^\d{4}$/i.test(s)) hits += 1;
  }
  return hits >= Math.ceil(labels.length * 0.5);
}

function isPlainObject(x) {
  return x != null && typeof x === 'object' && !Array.isArray(x);
}

function allPositive(nums) {
  return nums.every((n) => typeof n === 'number' && !Number.isNaN(n) && n >= 0) && nums.some((n) => n > 0);
}

/** Normaliza vários formatos comuns de API BI → formato dos modelos em src/graficos. */
export function normalizePayload(raw) {
  if (raw == null) return { kind: 'empty', data: {} };

  const unwrap = raw?.data !== undefined && isPlainObject(raw) && Object.keys(raw).length <= 3 ? raw.data : raw;
  const o = unwrap;

  if (!isPlainObject(o) && !Array.isArray(o)) return { kind: 'empty', data: {} };

  if (Array.isArray(o.items) && o.items.length && o.items[0]?.children != null) {
    return { kind: 'sunburst', data: { items: o.items } };
  }
  if (Array.isArray(o.items) && o.items.length && (o.items[0]?.value != null || o.items[0]?.valor != null)) {
    const items = o.items.map((x) => ({
      name: x.name ?? x.label ?? x.nome ?? '—',
      value: Number(x.value ?? x.valor ?? 0),
    }));
    return { kind: 'items', data: { items } };
  }

  if (Array.isArray(o.nodes) && Array.isArray(o.links)) {
    return { kind: 'sankey', data: { nodes: o.nodes, links: o.links } };
  }

  if (Array.isArray(o.xLabels) && Array.isArray(o.yLabels) && Array.isArray(o.data)) {
    return { kind: 'heatmap', data: { xLabels: o.xLabels, yLabels: o.yLabels, data: o.data } };
  }

  if (Array.isArray(o.indicators) && Array.isArray(o.series)) {
    return {
      kind: 'radar',
      data: {
        indicators: o.indicators,
        series: o.series.map((s) => ({
          name: s.name ?? 'Série',
          value: Array.isArray(s.value) ? s.value : s.values ?? [],
        })),
      },
    };
  }

  if (Array.isArray(o.points)) {
    return { kind: 'scatter', data: { points: o.points } };
  }

  if (o.value != null && (typeof o.value === 'number' || !Number.isNaN(Number(o.value)))) {
    if (o.min != null || o.max != null || o.name != null || Object.keys(o).length <= 5) {
      return {
        kind: 'gauge',
        data: {
          value: Number(o.value),
          min: o.min != null ? Number(o.min) : 0,
          max: o.max != null ? Number(o.max) : 100,
          name: o.name ?? '',
        },
      };
    }
  }

  if (Array.isArray(o.dimensions) && Array.isArray(o.series)) {
    return { kind: 'parallel', data: { dimensions: o.dimensions, series: o.series } };
  }

  if (Array.isArray(o.categories) && o.barSeries && o.lineSeries) {
    return {
      kind: 'mixed-line-bar',
      data: {
        categories: o.categories,
        barSeries: o.barSeries,
        lineSeries: o.lineSeries,
      },
    };
  }

  if (Array.isArray(o.categories) && Array.isArray(o.series)) {
    return {
      kind: 'cartesian',
      data: {
        categories: o.categories,
        series: o.series.map((s) => ({
          name: s.name ?? 'Série',
          data: Array.isArray(s.data) ? s.data.map(Number) : [],
        })),
        stacked: Boolean(o.stacked),
        smooth: Boolean(o.smooth),
      },
    };
  }

  const lbl = o.labels ?? o.categorias;
  if (Array.isArray(lbl)) {
    const series = [];
    const pushVals = (name, arr) => {
      if (Array.isArray(arr)) series.push({ name, data: arr.map(Number) });
    };
    pushVals('Valores', o.values ?? o.valores);
    pushVals('Receitas', o.receitas);
    pushVals('Despesas', o.despesas);
    pushVals('Série A', o.serieA);
    if (series.length === 0 && Array.isArray(o.datasets)) {
      o.datasets.forEach((d, i) => {
        if (d?.data) series.push({ name: d.name ?? `S${i + 1}`, data: d.data.map(Number) });
      });
    }
    if (series.length > 0) {
      return {
        kind: 'cartesian',
        data: {
          categories: lbl.map(String),
          series,
          stacked: Boolean(o.stacked),
          smooth: Boolean(o.smooth),
        },
      };
    }
  }

  if (Array.isArray(o.boxData)) {
    return {
      kind: 'boxplot',
      data: {
        categories: o.categories ?? o.labels ?? [],
        boxData: o.boxData,
        outliers: o.outliers ?? [],
      },
    };
  }

  if (Array.isArray(o.values) && Array.isArray(o.values[0]) && o.values[0].length === 4 && Array.isArray(o.categories)) {
    return { kind: 'candlestick', data: { categories: o.categories, values: o.values } };
  }

  if (Array.isArray(o.categories) && Array.isArray(o.links)) {
    return { kind: 'graph', data: { categories: o.categories, links: o.links } };
  }

  return { kind: 'empty', data: {} };
}

function cartesianToPieItems(categories, serie) {
  if (!Array.isArray(categories) || !serie?.data) return null;
  const items = categories.map((c, i) => ({
    name: String(c),
    value: Number(serie.data[i] ?? 0),
  }));
  if (items.length < 2 || items.length > 10) return null;
  if (!allPositive(items.map((x) => x.value))) return null;
  return { items };
}

function looksLikeFunnel(items) {
  if (!items || items.length < 3 || items.length > 10) return false;
  const vals = items.map((x) => Number(x.value));
  if (!vals.every((v) => v > 0)) return false;
  for (let i = 1; i < vals.length; i += 1) {
    if (vals[i] > vals[i - 1] * 1.05) return false;
  }
  return true;
}

/**
 * Heurísticas: tendência → linha/área; parte-do-todo → pizza/rosca; comparar categorias → colunas;
 * muitas categorias ou rótulos longos → barras horizontais; empilhado → bar-stacked; etc.
 */
export function inferChartId(normalized, hints = {}) {
  const reasons = [];
  const h = hints || {};
  const { kind, data } = normalized;

  const add = (chartId, confidence, msg) => {
    reasons.push(msg);
    return { chartId, confidence, reasons };
  };

  if (kind === 'empty') {
    return add('bar-vertical', 0.2, 'Sem dados: fallback colunas (preencha o JSON da API).');
  }

  if (kind === 'heatmap') return add('heatmap', 0.95, 'Estrutura x×y + matriz de valores → mapa de calor.');
  if (kind === 'sankey') return add('sankey', 0.95, 'Nós e links de fluxo → Sankey.');
  if (kind === 'sunburst') return add('sunburst', 0.9, 'Hierarquia em árvore → Sunburst.');
  if (kind === 'radar') return add('radar', 0.9, 'Múltiplas dimensões na mesma escala → radar.');
  if (kind === 'scatter') return add('scatter', 0.9, 'Pontos (x,y) → dispersão.');
  if (kind === 'gauge') return add('gauge', 0.95, 'Valor único com escala → velocímetro.');
  if (kind === 'parallel') return add('parallel', 0.9, 'Coordenadas paralelas para multivariado.');
  if (kind === 'mixed-line-bar') return add('mixed-line-bar', 0.95, 'Barras + linha com dois eixos.');
  if (kind === 'boxplot') return add('boxplot', 0.95, 'Distribuição (boxplot) detectada.');
  if (kind === 'candlestick') return add('candlestick', 0.95, 'Série OHLC → candlestick.');
  if (kind === 'graph') return add('graph', 0.85, 'Grafo de relações detectado.');

  if (kind === 'items') {
    const items = data.items ?? [];
    if (looksLikeFunnel(items)) {
      return add('funnel', 0.75, 'Valores decrescentes em etapas → funil.');
    }
    const n = items.length;
    if (n >= 2 && n <= 8) {
      if (h.forcePie) return add('pie', 0.85, 'Parte-do-todo explícito (hint) → pizza.');
      if (h.forceDonut || n > 5) return add('donut', 0.8, 'Poucas partes → rosca (melhor legibilidade).');
      return add('pie', 0.75, 'Poucas categorias com parcelas → pizza.');
    }
    if (n > 8) {
      return add('bar-horizontal', 0.7, 'Muitas fatias evitadas → barras horizontais.');
    }
  }

  if (kind === 'cartesian') {
    const { categories = [], series = [], stacked, smooth } = data;
    const nCat = categories.length;
    const nSer = series.length;
    const temporal = isLikelyTimeCategories(categories);
    const avgLabel =
      nCat > 0 ? categories.reduce((a, c) => a + String(c).length, 0) / nCat : 0;

    if (stacked || h.stacked) {
      return add('bar-stacked', 0.9, 'Séries empilhadas (dados ou hint).');
    }

    if (temporal) {
      if (nSer === 1) {
        if (h.preferArea || smooth) {
          return add('area', 0.85, 'Eixo temporal + uma série → área (tendência).');
        }
        return add('line', 0.9, 'Eixo temporal → linha (tendência).');
      }
      return add('line', 0.85, 'Eixo temporal com várias séries → linhas.');
    }

    if (nSer === 1 && nCat >= 2 && nCat <= 8 && (h.preferPartToWhole || h.forcePie)) {
      const pieData = cartesianToPieItems(categories, series[0]);
      if (pieData) {
        return add(h.forceDonut ? 'donut' : 'pie', 0.65, 'Poucas categorias + preferência parte-do-todo → pizza/rosca.', pieData);
      }
    }

    if (nCat > 14 || avgLabel > 18) {
      return add('bar-horizontal', 0.8, 'Muitas categorias ou rótulos longos → barras horizontais.');
    }

    if (nSer > 1) {
      return add('bar-vertical', 0.75, 'Comparar várias séries por categoria → colunas.');
    }

    return add('bar-vertical', 0.7, 'Comparação por categoria → colunas.');
  }

  return add('bar-vertical', 0.3, 'Fallback genérico → colunas.');
}

/** Ajusta payload final: se inferência escolheu pizza a partir de cartesian, devolve `chartData` convertido. */
export function runVizPipeline(rawPayload, hints = {}) {
  const normalized = normalizePayload(rawPayload);
  const inferred = inferChartId(normalized, hints);
  let chartData = normalized.data;
  let chartId = inferred.chartId;

  if (
    normalized.kind === 'cartesian' &&
    (chartId === 'pie' || chartId === 'donut') &&
    inferred.reasons.some((r) => r.includes('parte-do-todo'))
  ) {
    const pieData = cartesianToPieItems(normalized.data.categories, normalized.data.series?.[0]);
    if (pieData) chartData = pieData;
  }

  if (normalized.kind === 'items' && chartId === 'funnel') {
    chartData = { items: normalized.data.items };
  }

  if (normalized.kind === 'cartesian' && chartId === 'area') {
    chartData = {
      ...normalized.data,
      smooth: true,
    };
  }

  return {
    chartId,
    confidence: inferred.confidence,
    reasons: inferred.reasons,
    normalized,
    chartData,
    version: 1,
  };
}
