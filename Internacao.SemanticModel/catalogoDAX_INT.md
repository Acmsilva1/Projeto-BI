# 📘 Catálogo DAX — Internação (INT)

> **Modelo:** `Internacao.SemanticModel` | **Fonte:** PostgreSQL `cmc_hospital` | **Gerado em:** 2026-04-07

---

## 📑 Índice Rápido

### Tabela: `Medidas`
| # | Medida | Pasta | Formato |
|---|--------|-------|---------|
| 1 | [Dia D-1](#1-dia-d-1) | Outros | `Short Date` |
| 2 | [Qtd de altas](#2-qtd-de-altas) | Altas | `0` |
| 3 | [Qtd reinternacoes 30d](#3-qtd-reinternacoes-30d) | Reinternação | `0` |
| 4 | [% reinternacao 30d](#4--reinternacao-30d) | Reinternação | `%` |
| 5 | [Total dias internacao (Altas)](#5-total-dias-internacao-altas) | Internação | `0` |
| 6 | [TMP (dias) (0)](#6-tmp-dias-0) | Outros | Número |
| 7 | [Qtd internacoes](#7-qtd-internacoes) | Internação | `0` |
| 8 | [Qtd internacoes - Regional](#8-qtd-internacoes---regional) | Internação | `0` |
| 9 | [Qtd internacoes - Unidade](#9-qtd-internacoes---unidade) | Internação | `0` |
| 10 | [Qtd reinternacoes 7d](#10-qtd-reinternacoes-7d) | Reinternação | `0` |
| 11 | [% reinternacao 7d](#11--reinternacao-7d) | Reinternação | `%` |
| 12 | [Qtd UF sel (global)](#12-qtd-uf-sel-global) | Outros | `0` |
| 13 | [Qtd de altas - Regional](#13-qtd-de-altas---regional) | Altas | `0` |
| 14 | [Qtd de altas - Unidade](#14-qtd-de-altas---unidade) | Altas | `0` |
| 15 | [Qtd reinternacoes 7d - Regional](#15-qtd-reinternacoes-7d---regional) | Reinternação | `0` |
| 16 | [Qtd reinternacoes 7d - Unidade](#16-qtd-reinternacoes-7d---unidade) | Reinternação | `0` |
| 17 | [Qtd internacoes (UF x Unid)](#17-qtd-internacoes-uf-x-unid) | Internação | `0` |
| 18 | [Qtd de altas (UF x Unidade)](#18-qtd-de-altas-uf-x-unidade) | Altas | `0` |
| 19 | [Qtd reinternacoes 7d (UF x Unidade)](#19-qtd-reinternacoes-7d-uf-x-unidade) | Reinternação | `0` |
| 20 | [Qtd pacs atendidos](#20-qtd-pacs-atendidos) | Internação | `0` |
| 21 | [Qtd altas médicas até 10h](#21-qtd-altas-médicas-até-10h) | Altas | `0` |
| 22 | [% altas médicas até 10h](#22--altas-médicas-até-10h) | Altas | `%` |
| 23 | [Qtd altas hosp com alta médica](#23-qtd-altas-hosp-com-alta-médica) | Altas | `0` |
| 24 | [Qtd altas hosp até 2h (dt entrada)](#24-qtd-altas-hosp-até-2h-dt-entrada) | Altas | `0` |
| 25 | [% altas hosp até 2h](#25--altas-hosp-até-2h) | Altas | `%` |
| 26 | [Qtd de altas - evasao](#26-qtd-de-altas---evasao) | Altas | `0` |
| 27 | [Qtd de altas casa](#27-qtd-de-altas-casa) | Altas | `0` |
| 28 | [Qtd de altas transferência](#28-qtd-de-altas-transferência) | Altas | `0` |
| 29 | [Qtd óbitos](#29-qtd-óbitos) | Altas | `0` |
| 30 | [TMP (dias)](#30-tmp-dias) | Outros | Número |
| 31 | [Ranking internações UF](#31-ranking-internações-uf) | Internação | Texto |
| 32 | [Ranking altas UF](#32-ranking-altas-uf) | Altas | Texto |
| 33 | [Ranking % reinternacoes 7d UF](#33-ranking--reinternacoes-7d-uf) | Reinternação | Texto |
| 34 | [Ranking TMP (dias) UF](#34-ranking-tmp-dias-uf) | Outros | Texto |
| 35 | [Ranking internações](#35-ranking-internações) | Internação | Texto |
| 36 | [Qtd reinternacoes 7d mesmo CID](#36-qtd-reinternacoes-7d-mesmo-cid) | Reinternação | `0` |
| 37 | [% reinternacao 7d mesmo CID](#37--reinternacao-7d-mesmo-cid) | Reinternação | `%` |
| 38 | [Qtd reinternacoes 30d mesmo CID](#38-qtd-reinternacoes-30d-mesmo-cid) | Reinternação | `0` |
| 39 | [% reinternacao 30d mesmo CID](#39--reinternacao-30d-mesmo-cid) | Reinternação | `%` |
| 40 | [Qtd leitos ativos](#40-qtd-leitos-ativos) | Outros | `0` |
| 41 | [Qtd obitos > 24h](#41-qtd-obitos--24h) | Altas | `0` |
| 42 | [Tx mortalidade hospitalar](#42-tx-mortalidade-hospitalar) | Altas | `%` |
| 43 | [Tx mortalidade institucional](#43-tx-mortalidade-institucional) | Altas | `%` |
| 44 | [Qtd altas UTI](#44-qtd-altas-uti) | UTI | `0` |
| 45 | [Qtd reinternacoes UTI 48h](#45-qtd-reinternacoes-uti-48h) | UTI | `0` |
| 46 | [% reinternacao UTI 48h](#46--reinternacao-uti-48h) | UTI | `%` |
| 47 | [Paciente-dia no período](#47-paciente-dia-no-período) | Internação | `0` |
| 48 | [Pacientes UTI censo 0h](#48-pacientes-uti-censo-0h) | UTI | `0` |
| 49 | [Paciente-dia UTI censo](#49-paciente-dia-uti-censo) | UTI | `0` |
| 50 | [TMP UTI](#50-tmp-uti) | UTI | Número |
| 51 | [Qtd óbitos UTI](#51-qtd-óbitos-uti) | UTI | `0` |
| 52 | [% mortalidade UTI](#52--mortalidade-uti) | UTI | `%` |
| 53 | [Meta TMP](#53-meta-tmp) | Outros | `0` |
| 54 | [Cor meta TMP](#54-cor-meta-tmp) | Outros | Texto |
| 55 | [Data última atualização](#55-data-última-atualização) | Outros | `General Date` |
| 56 | [Paciente internado no período](#56-paciente-internado-no-período) | Internação | `0` |
| 57 | [Pacientes internados no dia](#57-pacientes-internados-no-dia) | Internação | `0` |
| 58 | [Paciente entra TMP](#58-paciente-entra-tmp) | Outros | `0` |
| 59 | [Dias permanência TMP](#59-dias-permanência-tmp) | Outros | `0` |
| 60 | [Cor TMP por atendimento](#60-cor-tmp-por-atendimento) | Outros | Texto |
| 61 | [Flag Óbito UTI (por alta)](#61-flag-óbito-uti-por-alta) | UTI | `0` |
| 62 | [Dias permanência TMP UTI](#62-dias-permanência-tmp-uti) | UTI | `0` |
| 63 | [Cor TMP UTI por atend](#63-cor-tmp-uti-por-atend) | UTI | Texto |
| 64 | [Qtd altas hosp até 2h (dt alta)](#64-qtd-altas-hosp-até-2h-dt-alta) | Altas | `0` |
| 65 | [Paciente UTI censo 0h (flag)](#65-paciente-uti-censo-0h-flag) | UTI | `0` |
| 66 | [Dias UTI no período](#66-dias-uti-no-período) | UTI | `0` |
| 67 | [TMP UTI no período (flag)](#67-tmp-uti-no-período-flag) | UTI | `0` |
| 68 | [Leitos Disponiveis no Dia](#68-leitos-disponiveis-no-dia) | Leitos | `0` |
| 69 | [Leito-Dia](#69-leito-dia) | Leitos | `0` |
| 70 | [Taxa Ocupacao Hospitalar](#70-taxa-ocupacao-hospitalar) | Internação | `%` |
| 71 | [Leito Disponivel Flag](#71-leito-disponivel-flag) | Leitos | `0` |

---

## 📂 Tabela: `Medidas`

### 1. Dia D-1
**Pasta:** `Outros`  
> Retorna o último dia com dados disponíveis. Se a data máxima for hoje, retorna o dia anterior (D-1); caso contrário, retorna a própria data máxima.
```dax
VAR MaxDataAll = CALCULATE(MAX(Internacao[DATA]), ALL(Internacao))
VAR DataAnteriorDisponivel = CALCULATE(MAX(Internacao[DATA]),
    FILTER(ALL(Internacao), Internacao[DATA] < MaxDataAll))
RETURN IF(MaxDataAll = TODAY(), DataAnteriorDisponivel, MaxDataAll)
```
**Formato:** `Short Date`

---

### 2. Qtd de altas
**Pasta:** `Altas`  
> Contagem distinta de atendimentos com alta hospitalar, ativando o relacionamento pela data de alta.
```dax
CALCULATE(
    DISTINCTCOUNT(Internacao[NR_ATENDIMENTO]),
    NOT ISBLANK(Internacao[DT_ALTA]),
    USERELATIONSHIP(Internacao[DT_ALTA_DATA], Calendario[Data]))
```

---

### 3. Qtd reinternacoes 30d
**Pasta:** `Reinternação`  
> Atendimentos distintos com reinternação entre 1 e 30 dias após a alta anterior.
```dax
CALCULATE(DISTINCTCOUNT(Internacao[NR_ATENDIMENTO]),
    FILTER(Internacao,
        NOT ISBLANK(Internacao[Dias Desde Alta Anterior])
        && Internacao[Dias Desde Alta Anterior] > 0
        && Internacao[Dias Desde Alta Anterior] <= 30))
```

---

### 4. % reinternacao 30d
**Pasta:** `Reinternação`  
> Taxa de reinternação em 30 dias: reinternações / total de altas.
```dax
DIVIDE([Qtd reinternacoes 30d], [Qtd de altas])
```
**Formato:** `0.00%;-0.00%;0.00%`

---

### 5. Total dias internacao (Altas)
**Pasta:** `Internação`  
> Soma dos dias de internação (data entrada → data alta) apenas para pacientes com alta.
```dax
SUMX(FILTER(Internacao, NOT ISBLANK(Internacao[DT_ALTA])),
    DATEDIFF(Internacao[DT_ENTRADA], Internacao[DT_ALTA], DAY))
```

---

### 6. TMP (dias) (0)
**Pasta:** `Outros`  
> Tempo Médio de Permanência com retorno mínimo de 0 (evita BLANK).
```dax
DIVIDE([Paciente-dia no período], [Qtd de altas]) + 0
```

---

### 7. Qtd internacoes
**Pasta:** `Internação`  
> Contagem distinta de internações pelo número de atendimento.
```dax
DISTINCTCOUNT(Internacao[NR_ATENDIMENTO])
```

---

### 8. Qtd internacoes - Regional
**Pasta:** `Internação`  
> Retorna a quantidade de internações apenas quando mais de 1 UF está selecionada (visão regional).
```dax
VAR NumUF = [Qtd UF sel (global)]
RETURN IF(NumUF > 1, [Qtd Internacoes], BLANK())
```

---

### 9. Qtd internacoes - Unidade
**Pasta:** `Internação`  
> Retorna a quantidade de internações apenas quando exatamente 1 UF está selecionada (visão por unidade).
```dax
VAR NumUF = [Qtd UF sel (global)]
RETURN IF(NumUF = 1, [Qtd internacoes], BLANK())
```

---

### 10. Qtd reinternacoes 7d
**Pasta:** `Reinternação`  
> Atendimentos distintos com reinternação entre 1 e 7 dias após a alta anterior.
```dax
CALCULATE(DISTINCTCOUNT(Internacao[NR_ATENDIMENTO]),
    FILTER(Internacao,
        NOT ISBLANK(Internacao[Dias Desde Alta Anterior])
        && Internacao[Dias Desde Alta Anterior] > 0
        && Internacao[Dias Desde Alta Anterior] <= 7))
```

---

### 11. % reinternacao 7d
**Pasta:** `Reinternação`  
> Taxa de reinternação em 7 dias (tratando BLANK como 0 no numerador).
```dax
VAR Altas = [Qtd de altas]
VAR Reint = COALESCE([Qtd reinternacoes 7d], 0)
RETURN IF(Altas > 0, DIVIDE(Reint, Altas), BLANK())
```
**Formato:** `0.00%;-0.00%;0.00%`

---

### 12. Qtd UF sel (global)
**Pasta:** `Outros`  
> Conta quantas Unidades Federativas distintas estão selecionadas no contexto atual. Usado para decidir entre visão regional vs. unidade.
```dax
COUNTROWS(ALLSELECTED(Internacao[UF unidade]))
```

---

### 13. Qtd de altas - Regional
**Pasta:** `Altas`  
> Altas apenas quando múltiplas UFs selecionadas.
```dax
VAR NumUF = [Qtd UF sel (global)]
RETURN IF(NumUF > 1, [Qtd de altas], BLANK())
```

---

### 14. Qtd de altas - Unidade
**Pasta:** `Altas`  
> Altas apenas quando exatamente 1 UF selecionada.
```dax
VAR NumUF = [Qtd UF sel (global)]
RETURN IF(NumUF = 1, [Qtd de altas], BLANK())
```

---

### 15. Qtd reinternacoes 7d - Regional
**Pasta:** `Reinternação`  
> Reinternações em 7d apenas para visão regional (múltiplas UFs).
```dax
VAR NumUF = [Qtd UF sel (global)]
RETURN IF(NumUF > 1, [Qtd reinternacoes 7d], BLANK())
```

---

### 16. Qtd reinternacoes 7d - Unidade
**Pasta:** `Reinternação`  
> Reinternações em 7d apenas para visão por unidade (1 UF).
```dax
VAR NumUF = [Qtd UF sel (global)]
RETURN IF(NumUF = 1, [Qtd reinternacoes 7d], BLANK())
```

---

### 17. Qtd internacoes (UF x Unid)
**Pasta:** `Internação`  
> Medida dinâmica que adapta o gráfico entre visão regional (por UF) e visão por unidade conforme número de UFs selecionadas e escopo do visual (`ISINSCOPE`).
```dax
VAR NumUF = [Qtd UF sel (global)]
RETURN SWITCH(TRUE(),
    NumUF > 1 && ISINSCOPE(Internacao[UF unidade]),  [Qtd internacoes - Regional],
    NumUF = 1 && ISINSCOPE(Internacao[UNIDADE]),     [Qtd internacoes - Unidade],
    BLANK())
```

---

### 18. Qtd de altas (UF x Unidade)
**Pasta:** `Altas`  
> Mesma lógica regional/unidade aplicada às altas hospitalares.
```dax
VAR NumUF = [Qtd UF sel (global)]
RETURN SWITCH(TRUE(),
    NumUF > 1 && ISINSCOPE(Internacao[UF unidade]), [Qtd de altas],
    NumUF = 1 && ISINSCOPE(Internacao[UNIDADE]),    [Qtd de altas],
    BLANK())
```

---

### 19. Qtd reinternacoes 7d (UF x Unidade)
**Pasta:** `Reinternação`  
> Mesma lógica regional/unidade para reinternações em 7 dias.
```dax
VAR NumUF = [Qtd UF sel (global)]
RETURN SWITCH(TRUE(),
    NumUF > 1 && ISINSCOPE(Internacao[UF unidade]), [Qtd reinternacoes 7d],
    NumUF = 1 && ISINSCOPE(Internacao[UNIDADE]),    [Qtd reinternacoes 7d],
    BLANK())
```

---

### 20. Qtd pacs atendidos
**Pasta:** `Internação`  
> Contagem distinta de pacientes atendidos (CD_PESSOA_FISICA).
```dax
DISTINCTCOUNT(Internacao[CD_PESSOA_FISICA])
```

---

### 21. Qtd altas médicas até 10h
**Pasta:** `Altas`  
> Quantidade de altas médicas condicionadas emitidas até as 10h, excluindo óbitos.
```dax
CALCULATE(
    DISTINCTCOUNT(Internacao[NR_ATENDIMENTO]),
    NOT ISBLANK(Internacao[DT_ALTA_MEDICA_CONDIC]),
    TIMEVALUE(Internacao[DT_ALTA_MEDICA_CONDIC]) <= TIME(10,0,0),
    Internacao[MOTIVO_ALTA_HOSPITALAR] <> "Óbito",
    USERELATIONSHIP(Internacao[DT_ALTA_DATA], Calendario[Data]))
```

---

### 22. % altas médicas até 10h
**Pasta:** `Altas`  
> Proporção de altas médicas emitidas até 10h sobre o total de altas médicas (excluindo óbitos).
```dax
DIVIDE(
    [Qtd altas médicas até 10h],
    CALCULATE(DISTINCTCOUNT(Internacao[NR_ATENDIMENTO]),
        NOT ISBLANK(Internacao[DT_ALTA_MEDICO]),
        Internacao[MOTIVO_ALTA_HOSPITALAR] <> "Óbito",
        USERELATIONSHIP(Internacao[DT_ALTA_DATA], Calendario[Data])))
```
**Formato:** `0.00%;-0.00%;0.00%`

---

### 23. Qtd altas hosp com alta médica
**Pasta:** `Altas`  
> Atendimentos com alta médica E alta hospitalar registradas.
```dax
CALCULATE(DISTINCTCOUNT(Internacao[NR_ATENDIMENTO]),
    NOT ISBLANK(Internacao[DT_ALTA_MEDICO]),
    NOT ISBLANK(Internacao[DT_ALTA]),
    USERELATIONSHIP(Internacao[DT_ALTA_DATA], Calendario[Data]))
```

---

### 24. Qtd altas hosp até 2h (dt entrada)
**Pasta:** `Altas`  
> Atendimentos cuja alta hospitalar ocorreu até 2h após a alta médica condicionada, filtrado por data de alta (com remoção do filtro de calendário para compatibilidade com slicer de entrada).
```dax
-- Remove filtro do calendário e recalcula pela data de alta
COUNTROWS(SUMMARIZE(
    FILTER(BaseSemFiltroEntrada,
        NOT ISBLANK(Internacao[DT_ALTA_MEDICA_CONDIC])
        && NOT ISBLANK(Internacao[DT_ALTA])
        && Internacao[DT_ALTA] <= Internacao[DT_ALTA_MEDICA_CONDIC] + TIME(2,0,0)
        && Internacao[DT_ALTA_DATA] IN DatasSelecionadas),
    Internacao[NR_ATENDIMENTO]))
```

---

### 25. % altas hosp até 2h
**Pasta:** `Altas`  
> Percentual de altas hospitalares ocorridas até 2h após a alta médica.
```dax
DIVIDE([Qtd altas hosp até 2h (dt entrada)], [Qtd altas hosp com alta médica])
```
**Formato:** `0.00%;-0.00%;0.00%`

---

### 26. Qtd de altas - evasao
**Pasta:** `Altas`  
> Quantidade de pacientes que evadiram (saíram sem alta formal), por data de alta.
```dax
CALCULATE(COUNTROWS(Internacao),
    Internacao[MOTIVO_ALTA_HOSPITALAR] = "Evadiu-se",
    NOT ISBLANK(Internacao[DT_ALTA_DATA]),
    USERELATIONSHIP(Internacao[DT_ALTA_DATA], Calendario[Data])) + 0
```

---

### 27. Qtd de altas casa
**Pasta:** `Altas`  
> Altas para domicílio — exclui óbitos, evasões e transferências.
```dax
CALCULATE(COUNTROWS(Internacao),
    NOT Internacao[MOTIVO_ALTA_HOSPITALAR] IN {"Óbito","Evadiu-se","Transferência Inter-Hospitalar"},
    NOT ISBLANK(Internacao[DT_ALTA_DATA]),
    USERELATIONSHIP(Internacao[DT_ALTA_DATA], Calendario[Data])) + 0
```

---

### 28. Qtd de altas transferência
**Pasta:** `Altas`  
> Quantidade de transferências inter-hospitalares.
```dax
CALCULATE(COUNTROWS(Internacao),
    Internacao[MOTIVO_ALTA_HOSPITALAR] = "Transferência Inter-Hospitalar",
    NOT ISBLANK(Internacao[DT_ALTA_DATA]),
    USERELATIONSHIP(Internacao[DT_ALTA_DATA], Calendario[Data])) + 0
```

---

### 29. Qtd óbitos
**Pasta:** `Altas`  
> Total de óbitos hospitalares por data de alta.
```dax
CALCULATE(COUNTROWS(Internacao),
    Internacao[MOTIVO_ALTA_HOSPITALAR] = "Óbito",
    NOT ISBLANK(Internacao[DT_ALTA_DATA]),
    USERELATIONSHIP(Internacao[DT_ALTA_DATA], Calendario[Data])) + 0
```

---

### 30. TMP (dias)
**Pasta:** `Outros`  
> Tempo Médio de Permanência em dias: paciente-dia / altas.
```dax
DIVIDE([Paciente-dia no período], [Qtd de altas])
```

---

### 31. Ranking internações UF
**Pasta:** `Internação`  
> Ícone ▲ para a UF com maior volume de internações e ▼ para a menor, no contexto selecionado.
```dax
VAR TabelaUF = ADDCOLUMNS(ALLSELECTED(Internacao[UF unidade]), "Qtd", CALCULATE([Qtd internacoes]))
VAR MaxQtd = MAXX(TabelaUF, [Qtd])
VAR MinQtd = MINX(TabelaUF, [Qtd])
VAR QtdAtual = [Qtd internacoes]
RETURN SWITCH(TRUE(),
    MaxQtd = MinQtd, BLANK(),
    QtdAtual = MaxQtd, UNICHAR(9650),
    QtdAtual = MinQtd, UNICHAR(9660),
    BLANK())
```

---

### 32. Ranking altas UF
**Pasta:** `Altas`  
> Ícone ▲/▼ para a UF com maior/menor volume de altas.
```dax
-- Mesma lógica de [Ranking internações UF] aplicada a [Qtd de altas]
VAR TabelaUF = ADDCOLUMNS(ALLSELECTED(Internacao[UF unidade]), "Qtd", CALCULATE([Qtd de altas]))
...
```

---

### 33. Ranking % reinternacoes 7d UF
**Pasta:** `Reinternação`  
> Ícone ▲ (pior = mais reinternações) / ▼ (melhor) para taxa de reinternação em 7d por UF. Considera apenas UFs com ao menos 1 alta.
```dax
VAR TabelaUF = FILTER(
    ADDCOLUMNS(ALLSELECTED(Internacao[UF unidade]),
        "QtdAltas", CALCULATE([Qtd de altas]),
        "Taxa",     CALCULATE([% reinternacao 7d])),
    [QtdAltas] > 0)
VAR MaxTaxa = MAXX(TabelaUF, [Taxa])
VAR MinTaxa = MINX(TabelaUF, [Taxa])
RETURN IF([Qtd de altas] > 0,
    SWITCH(TRUE(), MaxTaxa = MinTaxa, BLANK(),
        [% reinternacao 7d] = MaxTaxa, UNICHAR(9650),
        [% reinternacao 7d] = MinTaxa, UNICHAR(9660), BLANK()),
    BLANK())
```

---

### 34. Ranking TMP (dias) UF
**Pasta:** `Outros`  
> Ícone ▲ (maior TMP = pior) / ▼ (menor TMP = melhor) por UF. Considera apenas UFs com altas e TMP não nulo.
```dax
VAR TabelaUF = FILTER(
    ADDCOLUMNS(ALLSELECTED(Internacao[UF unidade]),
        "Altas", CALCULATE([Qtd de altas]),
        "TMP",   CALCULATE([TMP (dias)])),
    [Altas] > 0 && NOT ISBLANK([TMP]))
VAR MaxTMP = MAXX(TabelaUF, [TMP])
VAR MinTMP = MINX(TabelaUF, [TMP])
RETURN IF([Qtd de altas] > 0 && MaxTMP > MinTMP,
    SWITCH(TRUE(),
        [TMP (dias)] = MaxTMP, UNICHAR(9650),
        [TMP (dias)] = MinTMP, UNICHAR(9660), BLANK()),
    BLANK())
```

---

### 35. Ranking internações
**Pasta:** `Internação`  
> Mesma lógica de ranking por ▲/▼, mas comparando unidades (não UFs).
```dax
VAR Tabela = ADDCOLUMNS(ALLSELECTED(Internacao[UNIDADE]), "Qtd", CALCULATE([Qtd internacoes]))
VAR MaxQtd = MAXX(Tabela, [Qtd])
VAR MinQtd = MINX(Tabela, [Qtd])
VAR QtdAtual = [Qtd internacoes]
RETURN SWITCH(TRUE(),
    MaxQtd = MinQtd, BLANK(),
    QtdAtual = MaxQtd, UNICHAR(9650),
    QtdAtual = MinQtd, UNICHAR(9660), BLANK())
```

---

### 36. Qtd reinternacoes 7d mesmo CID
**Pasta:** `Reinternação`  
> Soma da coluna calculada `Reinternacao 7d mesmo CID` da tabela Internacao.
```dax
SUM(Internacao[Reinternacao 7d mesmo CID])
```

---

### 37. % reinternacao 7d mesmo CID
**Pasta:** `Reinternação`  
> Taxa de reinternação em 7 dias com mesmo CID sobre total de altas.
```dax
VAR Altas   = [Qtd de altas]
VAR ReintSC = COALESCE([Qtd reinternacoes 7d mesmo CID], 0)
RETURN IF(Altas > 0, DIVIDE(ReintSC, Altas), BLANK())
```
**Formato:** `0.00%;-0.00%;0.00%`

---

### 38. Qtd reinternacoes 30d mesmo CID
**Pasta:** `Reinternação`  
> Soma da coluna calculada `Reinternacao 30d mesmo CID`.
```dax
SUM(Internacao[Reinternacao 30d mesmo CID])
```

---

### 39. % reinternacao 30d mesmo CID
**Pasta:** `Reinternação`  
> Taxa de reinternação em 30 dias com mesmo CID sobre total de altas.
```dax
VAR Altas   = [Qtd de altas]
VAR Reint30 = COALESCE([Qtd reinternacoes 30d mesmo CID], 0)
RETURN IF(Altas > 0, DIVIDE(Reint30, Altas), BLANK())
```
**Formato:** `0.00%;-0.00%;0.00%`

---

### 40. Qtd leitos ativos
**Pasta:** `Outros`  
> Leitos ativos até o fim do dia selecionado (criados antes do dia e não inativados antes do fim do dia).
```dax
VAR Dia    = MAX(Calendario[Data])
VAR FimDia = Dia + 1
RETURN CALCULATE(DISTINCTCOUNT(Leitos[LEITO]),
    REMOVEFILTERS(Leitos[DT_CRIACAO]),
    FILTER(Leitos,
        Leitos[DT_CRIACAO] < FimDia
        && (Leitos[IE_SITUACAO] = "A" || ISBLANK(Leitos[DT_ATUALIZACAO]) || Leitos[DT_ATUALIZACAO] >= FimDia)))
```

---

### 41. Qtd obitos > 24h
**Pasta:** `Altas`  
> Óbitos institucionais (internação ≥ 24h), calculados pela data de alta independente do filtro de calendário de entrada.
```dax
-- Filtra óbitos com >=24h desde admissão (DT_ENTRADA_URGENCIA ou DT_ENTRADA)
COUNTROWS(SUMMARIZE(
    FILTER(BaseSemFiltroEntrada,
        Internacao[MOTIVO_ALTA_HOSPITALAR] = "ÓBITO"
        && NOT ISBLANK(Internacao[DT_ALTA])
        && Internacao[DT_ALTA_DATA] IN DatasSelecionadas
        && DATEDIFF(COALESCE(Internacao[DT_ENTRADA_URGENCIA], Internacao[DT_ENTRADA]),
            Internacao[DT_ALTA], HOUR) >= 24),
    Internacao[NR_ATENDIMENTO]))
```

---

### 42. Tx mortalidade hospitalar
**Pasta:** `Altas`  
> Taxa de mortalidade: óbitos / total de altas.
```dax
VAR Altas  = [Qtd de altas]
VAR Obitos = [Qtd óbitos]
RETURN IF(Altas > 0, DIVIDE(Obitos, Altas), BLANK())
```
**Formato:** `0.00%;-0.00%;0.00%`

---

### 43. Tx mortalidade institucional
**Pasta:** `Altas`  
> Taxa de mortalidade institucional (apenas óbitos com internação ≥ 24h): óbitos > 24h / total de altas.
```dax
VAR Altas      = [Qtd de altas]
VAR ObitosInst = [Qtd obitos > 24h]
RETURN IF(Altas > 0, DIVIDE(ObitosInst, Altas), BLANK())
```
**Formato:** `0.00%;-0.00%;0.00%`

---

### 44. Qtd altas UTI
**Pasta:** `UTI`  
> Saídas da UTI no período selecionado, via tabela `UTI_Episodios` (ignora filtros de Internacao e Calendario).
```dax
COUNTROWS(FILTER(
    CALCULATETABLE(UTI_Episodios,
        REMOVEFILTERS(Calendario), REMOVEFILTERS(Internacao),
        TREATAS(UnidadesSelecionadas, UTI_Episodios[UNIDADE])),
    NOT ISBLANK(UTI_Episodios[DT_SAIDA_UTI])
    && INT(UTI_Episodios[DT_SAIDA_UTI]) IN DatasSelecionadas))
```

---

### 45. Qtd reinternacoes UTI 48h
**Pasta:** `UTI`  
> Reinternações na UTI em até 48h, via flag na tabela `Movimentacao_pac`.
```dax
CALCULATE(COUNTROWS(Movimentacao_pac), Movimentacao_pac[ReinternouUTI_48h] = 1)
```

---

### 46. % reinternacao UTI 48h
**Pasta:** `UTI`  
> Taxa de reinternação na UTI em 48h sobre total de altas UTI.
```dax
DIVIDE([Qtd reinternacoes UTI 48h], [Qtd altas UTI])
```
**Formato:** `0.00%;-0.00%;0.00%`

---

### 47. Paciente-dia no período
**Pasta:** `Internação`  
> Soma diária dos pacientes internados para cada dia do período selecionado (census method).
```dax
SUMX(VALUES(Calendario[Data]), [Pacientes internados no dia])
```

---

### 48. Pacientes UTI censo 0h
**Pasta:** `UTI`  
> Contagem de pacientes presentes na UTI às 0h do dia selecionado (modelo de censo).
```dax
VAR d = SELECTEDVALUE(Calendario[Data])
RETURN IF(ISBLANK(d), BLANK(),
    COUNTROWS(FILTER(BaseEpisodios,
        UTI_Episodios[DT_ENTRADA_UTI] < d
        && (ISBLANK(UTI_Episodios[DT_SAIDA_UTI]) || UTI_Episodios[DT_SAIDA_UTI] >= d))))
```

---

### 49. Paciente-dia UTI censo
**Pasta:** `UTI`  
> Soma do censo da UTI às 0h para cada dia do período.
```dax
SUMX(VALUES(Calendario[Data]), CALCULATE([Pacientes UTI censo 0h]))
```

---

### 50. TMP UTI
**Pasta:** `UTI`  
> Tempo Médio de Permanência na UTI: paciente-dia UTI / altas UTI.
```dax
DIVIDE([Paciente-dia UTI censo], [Qtd altas UTI])
```

---

### 51. Qtd óbitos UTI
**Pasta:** `UTI`  
> Óbitos em setores UTI/UPC/UTI EXTRA, por data de alta.
```dax
VAR v = CALCULATE([Qtd Óbitos],
    KEEPFILTERS(Internacao[classif_setor] IN {"UTI","UPC","UTI EXTRA"}),
    USERELATIONSHIP(Internacao[DT_ALTA_DATA], Calendario[Data]))
RETURN IF(v = 0, BLANK(), v)
```

---

### 52. % mortalidade UTI
**Pasta:** `UTI`  
> Taxa de mortalidade na UTI: óbitos UTI / altas UTI.
```dax
VAR Altas  = [Qtd altas UTI]
VAR Obitos = [Qtd óbitos UTI]
RETURN IF(Altas > 0, DIVIDE(Obitos, Altas), BLANK())
```
**Formato:** `0.00%;-0.00%;0.00%`

---

### 53. Meta TMP
**Pasta:** `Outros`  
> Meta de TMP em dias conforme perfil selecionado: Clínica Médica = 5 dias, Clínica Cirúrgica = 2 dias.
```dax
VAR PerfilSel = SELECTEDVALUE(Internacao[PERFIL], "Clínica Médica")
RETURN SWITCH(PerfilSel, "Clínica Médica", 5, "Clínica Cirurgica", 2)
```

---

### 54. Cor meta TMP
**Pasta:** `Outros`  
> Retorna código de cor hexadecimal: verde `#25522B` se TMP ≤ meta, vermelho `#BE0C02` caso contrário.
```dax
VAR Tmp  = [TMP (dias)]
VAR Meta = [Meta TMP]
RETURN IF(NOT ISBLANK(Tmp) && NOT ISBLANK(Meta) && Tmp <= Meta, "#25522B", "#BE0C02")
```

---

### 55. Data última atualização
**Pasta:** `Outros`  
> Data máxima de entrada na tabela Internacao (usada como referência de atualização dos dados).
```dax
CALCULATE(MAX(Internacao[DT_ENTRADA]), ALL(Internacao))
```
**Formato:** `General Date`

---

### 56. Paciente internado no período
**Pasta:** `Internação`  
> Flag (1/0) indicando se o atendimento selecionado está ativo em algum momento do período do calendário.
```dax
VAR DataIni = MIN(Calendario[Data])
VAR DataFim = MAX(Calendario[Data])
VAR Entrada = INT(SELECTEDVALUE(Internacao[DT_ENTRADA]))
VAR Alta    = IF(ISBLANK(SELECTEDVALUE(Internacao[DT_ALTA])), DataFim,
                 INT(SELECTEDVALUE(Internacao[DT_ALTA])))
RETURN IF(NOT ISBLANK(Entrada) && Entrada <= DataFim && Alta >= DataIni, 1, 0)
```

---

### 57. Pacientes internados no dia
**Pasta:** `Internação`  
> Contagem de atendimentos ativos na data de referência do calendário (via `Movimentacao_pac`, censo).
```dax
VAR DataRef = SELECTEDVALUE(Calendario[Data])
RETURN IF(ISBLANK(DataRef), BLANK(),
    COUNTROWS(SUMMARIZE(
        FILTER(BaseSemFiltroData,
            NOT ISBLANK(Movimentacao_pac[NR_ATENDIMENTO])
            && NOT ISBLANK(Movimentacao_pac[DT_HISTORICO])
            && Movimentacao_pac[DT_HISTORICO] < DataRef
            && COALESCE(Movimentacao_pac[DT_FIM_HISTORICO], NOW()) >= DataRef),
        Movimentacao_pac[NR_ATENDIMENTO])))
```

---

### 58. Paciente entra TMP
**Pasta:** `Outros`  
> Flag (1/0) para verificar se um atendimento específico está ativo no período do calendário TMP (para relatório de TMP individualizado).
```dax
-- Verifica se o atendimento selecionado está ativo entre DataIni e DataFim do Calendario_TMP
RETURN IF(NOT ISBLANK(AtendimentoAtual) && TemTMP > 0, 1, 0)
```

---

### 59. Dias permanência TMP
**Pasta:** `Outros`  
> Dias de internação do atendimento atual (data alta − data entrada), para visão de linha individual no relatório TMP.
```dax
VAR Entrada     = MAX(Internacao[DT_ENTRADA])
VAR Alta        = MAX(Internacao[DT_ALTA])
VAR DataEntrada = INT(Entrada)
VAR DataAlta    = INT(Alta)
RETURN IF(NOT ISBLANK(Entrada) && NOT ISBLANK(Alta), DataAlta - DataEntrada, BLANK())
```

---

### 60. Cor TMP por atendimento
**Pasta:** `Outros`  
> Cor `#B6DBBB` (verde claro) quando o TMP do atendimento excede a meta; BLANK quando dentro da meta.
```dax
VAR Meta  = [Valor Meta TMP]
VAR Valor = [Dias permanência TMP]
RETURN IF(ISBLANK(Valor), BLANK(), IF(Valor > Meta, "#B6DBBB"))
```

---

### 61. Flag Óbito UTI (por alta)
**Pasta:** `UTI`  
> Retorna 1 quando motivo de alta é Óbito em setor UTI/UPC/UTI EXTRA; BLANK caso contrário.
```dax
IF(SELECTEDVALUE(Internacao[MOTIVO_ALTA_HOSPITALAR]) = "Óbito"
    && SELECTEDVALUE(Internacao[classif_setor]) IN {"UTI","UPC","UTI EXTRA"},
    1, BLANK())
```

---

### 62. Dias permanência TMP UTI
**Pasta:** `UTI`  
> Dias acumulados em UTI para o atendimento no período do calendário TMP (iteração dia a dia).
```dax
SUMX(VALUES(Calendario_TMP[Date]),
    VAR d    = Calendario_TMP[Date]
    VAR DtIni = MAX(UTI_Episodios[DT_ENTRADA_UTI])
    VAR DtFim = MAX(UTI_Episodios[DT_SAIDA_UTI])
    RETURN IF(DtIni < d && (ISBLANK(DtFim) || DtFim > d), 1, 0))
```

---

### 63. Cor TMP UTI por atend
**Pasta:** `UTI`  
> Cor `#B6DBBB` quando TMP UTI do atendimento excede a meta UTI paramétrica.
```dax
VAR Meta  = [Valor Meta TMP UTI]
VAR Valor = [Dias permanência TMP UTI]
RETURN IF(ISBLANK(Valor), BLANK(), IF(Valor > Meta, "#B6DBBB"))
```

---

### 64. Qtd altas hosp até 2h (dt alta)
**Pasta:** `Altas`  
> Variante de [24] para slicer com data de alta (sem remoção de filtro do calendário).
```dax
CALCULATE(DISTINCTCOUNT(Internacao[NR_ATENDIMENTO]),
    FILTER(Internacao,
        NOT ISBLANK(Internacao[DT_ALTA_MEDICA_CONDIC])
        && NOT ISBLANK(Internacao[DT_ALTA])
        && Internacao[DT_ALTA] <= Internacao[DT_ALTA_MEDICA_CONDIC] + TIME(2,0,0)))
```

---

### 65. Paciente UTI censo 0h (flag)
**Pasta:** `UTI`  
> Flag (1/0) por atendimento: estava em UTI às 0h da data do calendário TMP?
```dax
VAR d = SELECTEDVALUE(Calendario_TMP[Date])
VAR AtendimentoAtual = SELECTEDVALUE(Movimentacao_pac[NR_ATENDIMENTO])
RETURN IF(NOT ISBLANK(d) && NOT ISBLANK(AtendimentoAtual) && TemNoDia > 0, 1, 0)
```

---

### 66. Dias UTI no período
**Pasta:** `UTI`  
> Total de dias em que o atendimento estava em UTI no período selecionado.
```dax
SUMX(VALUES(Calendario[Data]), [Paciente UTI censo 0h (flag)])
```

---

### 67. TMP UTI no período (flag)
**Pasta:** `UTI`  
> Flag (1/0) indicando se o atendimento tem TMP UTI > 0 no período.
```dax
IF([Dias permanência TMP UTI] > 0, 1, 0)
```

---

### 68. Leitos Disponiveis no Dia
**Pasta:** `Leitos`  
> Soma dos leitos disponíveis (flag = 1) na data selecionada.
```dax
SUMX(VALUES(Leitos[cd_leito]), [Leito Disponivel Flag])
```

---

### 69. Leito-Dia
**Pasta:** `Leitos`  
> Total de leito-dia no período: soma diária de leitos disponíveis.
```dax
SUMX(ALLSELECTED(Calendario[Data]), [Leitos Disponiveis no Dia])
```

---

### 70. Taxa Ocupacao Hospitalar
**Pasta:** `Internação`  
> Taxa de ocupação: paciente-dia / leito-dia.
```dax
DIVIDE([Paciente-dia no período], [Leito-Dia], 0)
```
**Formato:** `0.00%;-0.00%;0.00%`

---

### 71. Leito Disponivel Flag
**Pasta:** `Leitos`  
> Flag (1/0) por leito: disponível na data se criado antes da data, ativo, e sem status de interdição/manutenção no período.
```dax
VAR vData        = MAX(Calendario[Data])
VAR DtCriacao    = MAX(Leitos[dt_criacao])
VAR IeSituacao   = MAX(Leitos[ie_situacao])
VAR BaseValida   = DtCriacao <= vData && ...
VAR ForaOperacao = CALCULATE(COUNTROWS(Movimentacao_leitos), ...) > 0
RETURN IF(BaseValida && NOT ForaOperacao, 1, 0)
```
> ⚠️ *Status que retiram o leito: C (chamado manutenção), D (pausa serviço), E (manutenção), I (interditado), U (radiação), M (acompanhante).*

---

*Catálogo gerado automaticamente a partir dos arquivos `.tmdl` — Power BI Semantic Model (TMDL)*
