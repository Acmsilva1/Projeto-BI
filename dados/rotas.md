# Gerência — dados por gráfico / painel

Uma linha por **elemento visual** na página Gerência. Exporta CSV com os nomes da coluna **Ficheiros CSV** (em `dados/`), alinhados ao teu warehouse.

| Painel / gráfico | O que precisas de dados (resumo) | Ficheiros CSV (lógicos) |
|------------------|----------------------------------|-------------------------|
| Totais PS (cartões no topo) | Atendimentos, altas, óbitos, evasões, desfecho médico, saídas, “internações” no sentido fluxo PS, conversões internação, reavaliações, medicados/medicações/lab/RX/ECG/TC/US e contagens associadas | `tbl_tempos_entrada_consulta_saida`, `tbl_altas_ps`, `tbl_intern_conversoes`, `tbl_tempos_reavaliacao`, `tbl_tempos_medicacao`, `tbl_vias_medicamentos`, `tbl_tempos_laboratorio`, `tbl_tempos_rx_e_ecg`, `tbl_tempos_tc_e_us`, `meta_tempos` |
| Tempo médio por etapa (tabela) | Médias em minutos: triagem, consulta, medicação, RX/ECG, TC/US, reavaliação, permanência; SLAs vêm de metas | `tbl_tempos_entrada_consulta_saida`, `tbl_tempos_medicacao`, `tbl_tempos_rx_e_ecg`, `tbl_tempos_tc_e_us`, `tbl_tempos_reavaliacao`, `meta_tempos` |
| Metas de acompanhamento (gauge + linhas) | Os mesmos indicadores % / médias que a matriz “Metas por volumes”, por mês e unidade | Igual à linha “Metas por volumes” |
| Metas por volumes (matriz) | % conversão, medicados, lab, TC, tempos acima meta, desfecho, etc., por mês e unidade | Todos os factos da linha “Totais PS” (mesmo conjunto) |
| % metas conformes (gráfico) | Agregação mensal das mesmas métricas + limiares em `meta_tempos` (e 2 constantes no código para conversão/desfecho) | Mesmo conjunto de factos + `meta_tempos` |
| Indicadores por unidade (tabela) | Uma linha por unidade: contagens e taxas (% evasão, conversão, medicados, lab, RX, ECG, TC, US, etc.) | Mesmo conjunto de factos + `meta_tempos` |
| Filtro unidade (topo) | Cadastro PS: código, nome, regional | `tbl_unidades` ou `tbl_unidades_teste` ou `tbl_unidades_prod` (basta uma com dados) |

**Conjunto mínimo de factos (se quiseres lista única):**  
`tbl_tempos_entrada_consulta_saida` · `tbl_tempos_medicacao` · `tbl_tempos_laboratorio` · `tbl_tempos_rx_e_ecg` · `tbl_tempos_tc_e_us` · `tbl_tempos_reavaliacao` · `tbl_altas_ps` · `tbl_intern_conversoes` · `tbl_vias_medicamentos` · `meta_tempos` (+ **uma** tabela de unidades acima).

API agregada: `GET /api/v1/gerencia/dashboard-bundle`.
