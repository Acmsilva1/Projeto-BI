# ðŸš‘ Linhagem Consolidada: Pronto-Socorro (PS)

Este documento demonstra como mÃºltiplas fontes do **Oracle Tasy** sÃ£o unificadas em uma Ãºnica estrutura de destino para auditoria.

---

## ðŸ”„ Fluxo de ConsolidaÃ§Ã£o (ETL)

```mermaid
graph LR
    subgraph "SISTEMA ORIGEM (ORACLE TASY)"
        T1[tasy.atendimento_paciente]
        T2[tasy.prescr_procedimento]
        T3[tasy.proc_interno]
        T4[tasy.atend_paciente_unid]
        T5[tasy.pessoa_fisica]
    end

    subgraph "STAGING (POSTGRESQL)"
        ST[tbl_tempos_entrada_consulta_saida]
        STX[tbl_tempos_rx_e_ecg]
        STM[tbl_tempos_medicacao]
    end

    subgraph "MODELO SEMÃ‚NTICO (DAX)"
        DAX['fluxo']
    end

    T1 & T4 & T5 -->|ConsolidaÃ§Ã£o| ST
    T2 & T3 -->|Filtragem Imagem| STX
    T2 & T3 -->|Filtragem FarmÃ¡cia| STM
    ST & STX & STM -->|Relacionamento 1:1| DAX
```

---

## ðŸ”— Matriz de Linhagem de Dados (Tabela Ãšnica)

**Tabela de Destino (Consolidada):** `tbl_tempos_entrada_consulta_saida` (Postgres) / `'fluxo'` (DAX)

| # | Medida DAX | Fonte Original (Oracle Tasy) | Staging (PostgreSQL) | Regra de NegÃ³cio / LÃ³gica |
|---|------------|----------------------------|----------------------|---------------------------|
| 1 | Atend > Triagem | `tasy.atendimento_paciente`| `tbl_tempos_entrada_consulta_saida` | Verifica se o tempo entre a entrada e a triagem ultrapassou a meta de 12 minutos. |
| 2 | % Atend > Triagem | `tasy.atendimento_paciente`| `tbl_tempos_entrada_consulta_saida` | Percentual de atendimentos com tempo de triagem acima da meta de 12 minutos. |
| 3 | Atend > Consulta | `tasy.atendimento_paciente`| `tbl_tempos_entrada_consulta_saida` | Verifica se o tempo entre a entrada e a consulta mÃ©dica ultrapassou a meta de 90 minutos. |
| 4 | % Atend > Consulta | `tasy.atendimento_paciente`| `tbl_tempos_entrada_consulta_saida` | Percentual de atendimentos com espera para consulta acima da meta de 90 minutos. |
| 5 | Atend > Medicacao | `tasy.prescr_procedimento` | `tbl_tempos_medicacao` | Verifica se o tempo entre a prescriÃ§Ã£o e a checagem da medicaÃ§Ã£o ultrapassou 30 minutos. |
| 6 | % Atend > Medicacao| `tasy.prescr_procedimento` | `tbl_tempos_medicacao` | Percentual de medicaÃ§Ãµes administradas com atraso superior a 30 minutos. |
| 7 | Atend > Tempo RX | `tasy.prescr_procedimento` | `tbl_tempos_rx_e_ecg` | Verifica se o tempo entre a solicitaÃ§Ã£o e a execuÃ§Ã£o do RX/ECG ultrapassou 60 minutos. |
| 8 | % Atend > Tempo RX| `tasy.prescr_procedimento` | `tbl_tempos_rx_e_ecg` | Percentual de exames de RX/ECG realizados fora do tempo alvo de 60 minutos. |
| 9 | Atend > Tempo TC | `tasy.prescr_procedimento` | `tbl_tempos_tc_e_us` | Verifica se o tempo entre a solicitaÃ§Ã£o e a execuÃ§Ã£o da Tomografia ultrapassou 120 minutos. |
| 10| % Atend > Tempo TC | `tasy.prescr_procedimento` | `tbl_tempos_tc_e_us` | Percentual de tomografias realizadas fora do tempo alvo de 120 minutos. |
| 11| Atend > Reaval | `tasy.atend_paciente_unid` | `tbl_tempos_reavaliacao`| Verifica se o tempo entre a solicitaÃ§Ã£o de reavaliaÃ§Ã£o e o desfecho clÃ­nico excedeu a meta. |
| 12| % Atend > Reaval | `tasy.atend_paciente_unid` | `tbl_tempos_reavaliacao`| Percentual de pacientes que aguardaram reavaliaÃ§Ã£o alÃ©m do tempo institucional. |
| 13| Atend > Tempo Alta | `tasy.atendimento_paciente`| `tbl_tempos_entrada_consulta_saida` | Verifica se a permanÃªncia total do paciente no PS excedeu a meta de 4 horas (240 min). |
| 14| % Atend > Tempo Alta| `tasy.atendimento_paciente`| `tbl_tempos_entrada_consulta_saida` | Percentual de atendimentos com permanÃªncia total acima da meta de 4 horas. |
| 15| Qtd Atend | `tasy.atendimento_paciente`| `tbl_tempos_entrada_consulta_saida` | Contagem total de fichas de atendimento Ãºnicas geradas no perÃ­odo selecionado. |
| 16| Percentual DinÃ¢mico | `MÃºltiplas Tabelas` | â€” | SeleÃ§Ã£o dinÃ¢mica de indicadores de performance via parÃ¢metro de campo no Power BI. |
| 17| media_min_triagem | `tasy.atendimento_paciente`| `tbl_tempos_entrada_consulta_saida` | Tempo mÃ©dio real, em minutos, decorrido entre a recepÃ§Ã£o e o inÃ­cio da triagem. |
| 18| media_min_consulta| `tasy.atendimento_paciente`| `tbl_tempos_entrada_consulta_saida` | Tempo mÃ©dio real, em minutos, decorrido entre a recepÃ§Ã£o e o inÃ­cio do atendimento mÃ©dico. |
| 19| % evasao | `tasy.motivo_alta` | `tbl_tempos_entrada_consulta_saida` | Percentual de pacientes que abandonaram o pronto-socorro antes do desfecho clÃ­nico. |
| 20| Qtd Evasao | `tasy.motivo_alta` | `tbl_tempos_entrada_consulta_saida` | NÃºmero total de pacientes registrados com desfecho de evasÃ£o. |
| 21| **MÃ©dia PermanÃªncia PS** | `tasy.atendimento_paciente`| `tbl_tempos_entrada_consulta_saida` | CÃ¡lculo do tempo mÃ©dio de estadia na urgÃªncia (SQL: `AVG(dt_alta - dt_entrada)`). |

---

## ðŸ› ï¸ Notas de Auditoria
As metas de tempo do Pronto-Socorro (12min Triagem, 90min Consulta, 60min RX, 240min PermanÃªncia Total) sÃ£o parÃ¢metros institucionais para o nÃ­vel de serviÃ§o.

