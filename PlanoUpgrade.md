# Plano Upgrade (Fast-Track)

## Arquitetura oficial (fonte canônica)

Toda implementação segue **[Novo BI/Documentacao.md](./Novo%20BI/Documentacao.md)**:

- **Backend (Maestro):** Express em `Novo BI/backend/` — `server.js` (rotas), `live_service.js` (negócio/cache), `db.js` (PostgreSQL), `infra/` (Redis + RabbitMQ).
- **Frontend:** React 18 + Vite 8 + Tailwind + ECharts em `Novo BI/frontend/src/` — `App.jsx`, seções em `components/sections/` (ex.: `PsSection.jsx`), gráficos em `components/charts/` (`DynamicChart`), dados via `hooks/useApi.js`. O `frontend/index.html` é **somente o template do Vite**, não destino de lógica de dashboard.
- **SQL:** views e objetos em **`Novo BI/sql/database/`** (versionamento por arquivo).
- **Ambiente local:** a partir de `Novo BI/frontend` — `npm run infra:up`, `npm i`, `npm run dev` (API porta **3001**, proxy no Vite). Produção: `npm run build` no frontend.
- **Python 3.10+** restrito a `pipeline_guard.py` (CI/guardião), fora do caminho deste upgrade funcional.

---

## Objetivo

Entregar rapidamente no Hospital BI (Node + React) o que for compatível com o Power BI, reaproveitando a base já pronta.

## Premissas

- A stack acima já atende; não duplicar entregas em pastas fora da árvore documentada (ex.: módulos HTML legados não são alvo).
- Priorizar **paridade funcional**, não cópia visual 1:1.
- Manter o que já existe e atende.

## Compatibilidade já coberta (base atual)

- [x] KPIs gerais e visão por unidade.
- [x] PS: volumes, SLAs, matriz, histórico 3 meses (API); **UI React** ainda pode integrar melhor `ps/slas` e `ps/history` na seção PS.
- [x] Internações: KPIs/resumo/tendência.
- [x] Cirurgias/CC: evolução e performance.
- [x] Financeiro: resumo, convênios, glosas.

## Entregas faltantes (Power BI → Hospital BI)

1. `Perfil PS` (demográfico e médico) — atenção **LGPD**: agregação mínima, mascaramento ou RLS conforme política interna.
2. `Fluxos PS` (hora × dia + tempos médios detalhados).
3. `Medicação` (vias, rápida/lenta, top 10).
4. `Conversão PS × Internação` (global, unidade, mensal completo).

---

## Plano de ação simplificado

### Etapa 1 — Contrato de dados (1 dia)

- [x] Mapear painéis dos DOCX para blocos técnicos.
- [ ] Fechar campos por endpoint novo (`filtro`, `label`, `métrica`, `período`); filtros globais: `period`, `regional`, **`unidade`** (repassar em todas as chamadas `useApi` das seções afetadas).
- [ ] Definir regra de “compatível”: tolerância de diferença vs Power BI.

### Etapa 2 — SQL / views (1–2 dias)

- [ ] Criar views em `sql/database/` para `perfil_ps` (ex.: `vw_perfil_ps` ou arquivo dedicado no padrão do repositório).
- [ ] Criar views para `fluxos_ps`.
- [ ] Criar views para `medicacao_ps`.
- [ ] Criar views para `conversao_ps_internacao`.
- [ ] Validar performance e filtro por `regional`, `unidade`, `period`; avaliar cache em `live_service.js` / Redis para consultas pesadas (heatmap, top 10).

### Etapa 3 — API Node (1 dia)

- [ ] Expor rotas em `/api/v1/ps/perfil/*` (ou recursos equivalentes sob `psRouter` em `server.js`).
- [ ] Expor rotas em `/api/v1/ps/fluxos/*`.
- [ ] Expor rotas em `/api/v1/ps/medicacao/*`.
- [ ] Expor rotas em `/api/v1/ps/conversao/*`.
- [ ] Implementar handlers em `live_service.js` + `fetchView` em `db.js`; retorno padronizado `{ ok, data }` (já aplicado pelo wrapper de rota em `server.js`).

### Etapa 4 — Frontend React (2 dias)

- [ ] Estender **`frontend/src/components/sections/PsSection.jsx`** (ou subcomponentes em `components/`) com os 4 blocos novos.
- [ ] Usar **`DynamicChart`** / ECharts conforme padrão do projeto; novos gráficos específicos em `components/charts/` se necessário.
- [ ] Conectar **filtros globais** (`App.jsx` → `Topbar`): garantir `period`, `regional` e **`unidade`** nos params do `useApi` para PS e blocos novos.
- [ ] Onde fizer sentido, consumir **`ps/slas`** e **`ps/history`** já existentes na API.
- [ ] Entregar SPA navegável completa via `npm run dev`.

### Etapa 5 — Validação e go-live (1 dia)

- [ ] Comparar números com Power BI (amostra por unidade e total).
- [ ] Ajustar divergências de cálculo.
- [ ] Smoke test dos endpoints críticos.
- [ ] Publicar versão interna (build com `npm run build` no frontend quando for release estática otimizada).

---

## Checklist de execução do agente

- [ ] Checklist de SQL concluído.
- [ ] Checklist de API concluído.
- [ ] Checklist de frontend concluído.
- [ ] Checklist de validação concluído.
- [ ] Release interna concluída.

## Definição de pronto (final)

- [ ] Os 4 blocos faltantes estão funcionais na API e na UI React documentada.
- [ ] Filtros globais (incluindo `unidade`) funcionam nos blocos novos e estão alinhados ao contrato.
- [ ] Diferenças vs Power BI documentadas e aceitas.
- [ ] Deploy interno realizado com sucesso.

## Fora de escopo (fast-track)

Exportação tipo Power BI (PDF/Excel), bookmarks, drill-through dedicado e layouts mobile específicos — salvo decisão explícita posterior.

## Histórico

- 2026-04-07: Plano inicial criado.
- 2026-04-07: Plano simplificado para fast-track de entrega.
- 2026-04-08: Alinhado à arquitetura oficial em `Novo BI/Documentacao.md` (React/Vite, `sql/database/`, Maestro, fluxo `npm run dev`).
