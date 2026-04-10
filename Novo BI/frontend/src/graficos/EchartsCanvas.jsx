import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

/**
 * Canvas único ECharts — recebe `option` já montado pelo modelo.
 * Passe dados do seu fetch para o *modelo* (buildOption), não direto aqui.
 */
export default function EchartsCanvas({
  option,
  className = '',
  style = {},
  height = 360,
  loading = false,
  onEvents,
}) {
  const merged = useMemo(() => option || {}, [option]);

  return (
    <ReactECharts
      echarts={echarts}
      option={merged}
      notMerge
      lazyUpdate={false}
      className={className}
      style={{ height, width: '100%', minHeight: height, ...style }}
      showLoading={loading}
      loadingOption={{
        text: 'Carregando…',
        color: '#0ea5e9',
        textColor: '#94a3b8',
        maskColor: 'rgba(15, 23, 42, 0.6)',
      }}
      onEvents={onEvents}
      opts={{ renderer: 'canvas' }}
    />
  );
}
