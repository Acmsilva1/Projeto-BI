# Documentação Técnica - NOVO BI

## 0. Identificação do artefato [T]

| Campo | Descrição |
| :--- | :--- |
| **DOC-ID** | NOVOBI-CORE-TEC-R01 |
| **Módulo** | Core - Dashboard de Metas e Jornada |
| **Repositório** | Acmsilva1/Projeto-BI |
| **Status** | Consolidado na Raiz |

## 1. Resumo funcional e utilizadores impactados [T]
Sistema de Business Intelligence para gestão hospitalar, focado em tempos de fluxo (PS) e metas dinâmicas. Utilizado pela gestão estratégica para monitoramento de indicadores com inteligência estatística (Z-Score).

## 2. Superfícies, rotas e estrutura de navegação [F]
| ID Interno | Rota SPA | Componente Raiz | Nota |
| :--- | :--- | :--- | :--- |
| PAINEL_JORNADA | `/` | `web/src/features/jornada/App.tsx` | Dashboard principal de fluxo. |
| PAINEL_GERENCIAL | `/gerencial` | `web/src/features/gerencial/` | Visão de metas e volumes. |
| PAINEL_INTERNACAO | `/internacao` | `web/src/features/internacao/` | Censo e status de leitos. |

## 3. Interface (frontend) [F]
- **Arquitetura:** Feature-Based Slices. Cada painel vive em sua própria pasta em `web/src/features/`.
- **Componentes:** Baseados em Shadcn/ui e Tailwind para Dark Mode nativo.
- **Gráficos:** Implementados via ECharts e Recharts para alta performance volumétrica.

## 4. Backend, API e processamento [B]
| ID Superfície | Método e Caminho | Observação |
| :--- | :--- | :--- |
| CORE | `GET /api/v1/jornada/metas` | Agregação com Z-Score (1.5 Sigma). |
| CORE | `GET /api/v1/jornada/volumes` | Processamento de datasets CSV. |

## 5. Persistência, dados e consultas [B]
- **Engine:** DuckDB para processamento analítico local.
- **Gateway:** `csv-memory` (Carregamento de datasets CSV em RAM para velocidade).
- **Z-Score:** Cálculo dinâmico com histórico de 12 meses e cache de indicadores para performance.

## 6. Segurança e conformidade (LGPD) [T]
- **Dados:** PHI/PII anonimizados no gateway de memória.
- **Logs:** Proteção contra exposição de dados sensíveis em console.

## 7. Infraestrutura, ambiente e operações [B]
- **Runtime:** Node.js 22+.
- **Portas:** Web (5175), API (3333).
- **Scripts:** `npm run dev` gerencia a orquestração paralela via `concurrently`.

## 8. Observações técnicas e registo de revisão [T]
- **Dívida Técnica:** Cache de Z-Score implementado reduz latência em 73%.
- **Revisão:** Documento revisado em 04/05/2026 — `NOVOBI-CORE-TEC-R01`.
