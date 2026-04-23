# 📘 Catálogo DAX — Pronto-Socorro (PS)

> **Modelo:** `Tempos fluxos PS.SemanticModel` | **Fonte:** PostgreSQL | **Gerado em:** 2026-04-07

---

## 📑 Índice Rápido

### Tabela: `Medidas` (Principais Fluxos e Tempos)
| # | Medida | Pasta | Formato |
|---|--------|-------|---------|
| 1 | [Qtd Atend > Tempo triagem](#1-qtd-atend--tempo-triagem) | TRIAGEM | `0` |
| 2 | [% Atend > Tempo triagem](#2--atend--tempo-triagem) | TRIAGEM | `%` |
| 3 | [Qtd Atend > Tempo consulta](#3-qtd-atend--tempo-consulta) | CONSULTA | `0` |
| 4 | [% Atend > Tempo consulta](#4--atend--tempo-consulta) | CONSULTA | `%` |
| 5 | [Qtd Atend > Tempo medicacao](#5-qtd-atend--tempo-medicacao) | MEDICACOES | `0` |
| 6 | [% Atend > Tempo medicacao](#6--atend--tempo-medicacao) | MEDICACOES | `%` |
| 7 | [Qtd Atend > Tempo RX](#7-qtd-atend--tempo-rx) | RX/ECG | `0` |
| 8 | [% Atend > Tempo RX](#8--atend--tempo-rx) | RX/ECG | `%` |
| 9 | [Qtd Atend > Tempo TC](#9-qtd-atend--tempo-tc) | TC/US | `0` |
| 10 | [% Atend > Tempo TC](#10--atend--tempo-tc) | TC/US | `%` |
| 11 | [Qtd Atend > Tempo reavaliacao](#11-qtd-atend--tempo-reavaliacao) | REAVALIACAO | `0` |
| 12 | [% Atend > Tempo reavaliacao](#12--atend--tempo-reavaliacao) | REAVALIACAO | `%` |
| 13 | [Qtd Atend > Tempo alta](#13-qtd-atend--tempo-alta) | ALTA | `0` |
| 14 | [% Atend > Tempo alta](#14--atend--tempo-alta) | ALTA | `%` |
| 15 | [Qtd Atend](#15-qtd-atend) | OUTROS | `0` |
| 16 | [Percentual Dinâmico](#16-percentual-dinamico) | OUTROS | `%` |
| 17 | [media_min_triagem](#17-media-min-triagem) | TRIAGEM | `0.0` |
| 18 | [media_min_consulta](#18-media-min-consulta) | CONSULTA | Decimal |
| 19 | [% evasao](#19--evasao) | OUTROS | `%` |
| 20 | [Qtd Evasao](#20-qtd-evasao) | OUTROS | `0` |

---

## 📂 Tabela: `Medidas`

### 1. Qtd Atend > Tempo triagem
**Pasta:** `TRIAGEM`
> Quantidade de atendimentos que excederam o tempo limite paramétrico para triagem.
```dax
VAR LimiteMinutos = Meta_triagem[Valor Meta_triagem]
RETURN CALCULATE(COUNT(fluxo[NR_ATENDIMENTO]), FILTER(fluxo, fluxo[MIN_ENTRADA_X_TRIAGEM] > LimiteMinutos))
```

### 2. % Atend > Tempo triagem
**Pasta:** `TRIAGEM`
> Percentual de atendimentos acima do tempo de triagem.
```dax
VAR AtendAcima = CALCULATE(COUNT(fluxo[NR_ATENDIMENTO]), FILTER(fluxo, fluxo[MIN_ENTRADA_X_TRIAGEM] > Meta_triagem[Valor Meta_triagem]))
RETURN DIVIDE(AtendAcima, CALCULATE(COUNT(fluxo[NR_ATENDIMENTO])), 0)
```

### 3. Qtd Atend > Tempo consulta
**Pasta:** `CONSULTA`
> Atendimentos que excederam a meta de tempo para atendimento médico.
```dax
VAR LimiteMinutos = Meta_consulta[Valor Meta_consulta]
RETURN CALCULATE(COUNT(fluxo[NR_ATENDIMENTO]), FILTER(fluxo, fluxo[MIN_ENTRADA_X_CONSULTA] > LimiteMinutos)) + 0
```

### 4. % Atend > Tempo consulta
**Pasta:** `CONSULTA`
> Percentual de atendimentos acima do tempo de consulta.
```dax
VAR AtendAcima = CALCULATE(COUNT(fluxo[NR_ATENDIMENTO]), FILTER(fluxo, fluxo[MIN_ENTRADA_X_CONSULTA] > Meta_consulta[Valor Meta_consulta]))
RETURN DIVIDE(AtendAcima, CALCULATE(COUNT(fluxo[NR_ATENDIMENTO])), 0)
```

### 5. Qtd Atend > Tempo medicacao
**Pasta:** `MEDICACOES`
> Atendimentos cujo tempo de medicação superou a meta parametrizada.
```dax
VAR LimiteMinutos = Meta_medicacao[Valor Meta_medicacao]
RETURN CALCULATE(COUNT(medicacao[NR_ATENDIMENTO]), FILTER(medicacao, medicacao[MINUTOS] > LimiteMinutos)) + 0
```

### 6. % Atend > Tempo medicacao
**Pasta:** `MEDICACOES`
> Percentual de atendimentos fora da meta de tempo para medicamentos.
```dax
VAR AtendAcima = CALCULATE(COUNT(medicacao[NR_ATENDIMENTO]), FILTER(medicacao, medicacao[MINUTOS] > Meta_medicacao[Valor Meta_medicacao]))
RETURN DIVIDE(AtendAcima, CALCULATE(COUNT(medicacao[NR_ATENDIMENTO])), 0)
```

### 7. Qtd Atend > Tempo RX
**Pasta:** `RX/ECG`
> Atendimentos com tempo de exame de Raio-X ou ECG superior à meta.
```dax
VAR LimiteMinutos = Meta_ECG_RX[Valor Tempo Minutos]
RETURN CALCULATE(COUNT('RX e ECG'[NR_PRESCRICAO]), FILTER('RX e ECG', 'RX e ECG'[Diferença Minutos RX_ECG] > LimiteMinutos))
```

### 8. % Atend > Tempo RX
**Pasta:** `RX/ECG`
> Proporção de atendimentos com RX/ECG fora do padrão de tempo.
```dax
DIVIDE(CALCULATE(COUNT('RX e ECG'[NR_PRESCRICAO]), FILTER('RX e ECG', 'RX e ECG'[Diferença Minutos RX_ECG] > Meta_ECG_RX[Valor Tempo Minutos])), CALCULATE(COUNT('RX e ECG'[NR_PRESCRICAO])), 0)
```

### 9. Qtd Atend > Tempo TC
**Pasta:** `TC/US`
> Pacientes que esperaram tempo superior ao estipulado para Tomografia.
```dax
VAR LimiteMinutos = 'Metas tipo_TC_US'[Valor Meta_TC_US]
RETURN CALCULATE(COUNT('TC e US'[NR_PRESCRICAO]), FILTER('TC e US', 'TC e US'[Diferença minutos TC_US] > LimiteMinutos))
```

### 10. % Atend > Tempo TC
**Pasta:** `TC/US`
> Proporção de exames de Tomografia fora da meta.
```dax
DIVIDE(CALCULATE(COUNT('TC e US'[NR_PRESCRICAO]), FILTER('TC e US', 'TC e US'[Diferença minutos TC_US] > 'Metas tipo_TC_US'[Valor Meta_TC_US])), CALCULATE(COUNT('TC e US'[NR_PRESCRICAO])), 0)
```

### 11. Qtd Atend > Tempo reavaliacao
**Pasta:** `REAVALIACAO`
> Quantidade de reavaliações médicas que superaram o tempo limite estipulado.
```dax
VAR LimiteMinutos = [Valor Meta_reavaliacao]
RETURN CALCULATE(COUNT(reavaliacao[NR_ATENDIMENTO]), FILTER(reavaliacao, DATEDIFF(reavaliacao[DT_SOLIC_REAVALIACAO], reavaliacao[DT_EVO_PRESC], MINUTE) > LimiteMinutos)) + 0
```

### 12. % Atend > Tempo reavaliacao
**Pasta:** `REAVALIACAO`
> Percentual de reavaliações fora da meta em relação às reavaliações válidas totais.
```dax
DIVIDE([AtendAcima], [TotalAtend], 0)
```

### 13. Qtd Atend > Tempo alta
**Pasta:** `ALTA`
> Atendimentos cuja permanência até a alta superou o total esperado em minutos.
```dax
VAR LimiteMinutos = Meta_alta[Valor Meta_alta]
RETURN CALCULATE(COUNT(fluxo[NR_ATENDIMENTO]), FILTER(fluxo, fluxo[MIN_ENTRADA_X_ALTA] > LimiteMinutos))
```

### 14. % Atend > Tempo alta
**Pasta:** `ALTA`
> Percentual de pacientes com tempo prolongado até a alta final.
```dax
DIVIDE(CALCULATE(COUNT(fluxo[NR_ATENDIMENTO]), FILTER(fluxo, fluxo[MIN_ENTRADA_X_ALTA] > Meta_alta[Valor Meta_alta])), CALCULATE(COUNT(fluxo[NR_ATENDIMENTO])), 0)
```

### 15. Qtd Atend
**Pasta:** `OUTROS`
> Total de atendimentos distintos calculados no modelo.
```dax
DISTINCTCOUNT(fluxo[NR_ATENDIMENTO])+0
```

### 16. Percentual Dinâmico
**Pasta:** `OUTROS`
> Medida dinâmica que realiza troca do indicador métrico (% Triagem, % Consulta, % Atend...) baseada na seleção do parâmetro.
```dax
VAR SelecaoParametro = SELECTEDVALUE('Tabela_Parametro_Medidas'[Parametro])
RETURN SWITCH(SelecaoParametro, "TRIAGEM >12MIN", DIVIDE(...), "CONSULTAS >1:30H", DIVIDE(...), ...)
```

### 17. media_min_triagem
**Pasta:** `TRIAGEM`
> Cálculo básico de média de tempo decorrido da entrada até a conclusão da triagem.
```dax
AVERAGE(fluxo[MIN_ENTRADA_X_TRIAGEM])
```

### 18. media_min_consulta
**Pasta:** `CONSULTA`
> Cálculo básico de média de tempo para consulta do fluxo principal.
```dax
AVERAGE(fluxo[MIN_ENTRADA_X_CONSULTA])
```

### 19. % evasao
**Pasta:** `OUTROS`
> Porcentagem de pacientes que evadiram do PS do total de atendimentos.
```dax
([Qtd Evasao] / [Qtd Atend]) + 0
```

### 20. Qtd Evasao
**Pasta:** `OUTROS`
> Quantidade de pacientes classificados com alta do tipo 'Evadiu-se'.
```dax
CALCULATE(COUNTROWS ( fluxo ), fluxo[alta_hospitalar] = "Evadiu-se", NOT ISBLANK(fluxo[DT_ALTA_DATA]), USERELATIONSHIP (fluxo[DT_ALTA_DATA], Calendario[Data])) + 0
```

---
*Catálogo gerado automaticamente a partir dos arquivos `.tmdl` — Power BI Semantic Model (TMDL)*
