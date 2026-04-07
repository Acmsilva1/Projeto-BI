# Plano Upgrade (Fast-Track)

## Objetivo
Entregar rapidamente no sistema Node.js o que for compatível do Power BI, reaproveitando a base que já está pronta.

## Premissas
- A arquitetura atual já atende (Node API + frontend modular + SQL/views).
- Vamos priorizar paridade funcional, não cópia visual 1:1.
- Tudo que já existe e atende será mantido.

## Compatibilidade Já Coberta (base atual)
- [x] KPIs gerais e visão por unidade.
- [x] PS: volumes, SLAs, matriz, histórico 3 meses.
- [x] Internações: KPIs/resumo/tendência.
- [x] Cirurgias/CC: evolução e performance.
- [x] Financeiro: resumo, convênios, glosas.

## Entregas Faltantes (Power BI -> Node)
1. `Perfil PS` (demográfico e médico).
2. `Fluxos PS` (hora x dia + tempos médios detalhados).
3. `Medicação` (vias, rápida/lenta, top 10).
4. `Conversão PS x Internação` (global, unidade, mensal completo).

---

## Plano de Ação Simplificado

### Etapa 1 - Contrato de Dados (1 dia)
- [x] Mapear painéis dos DOCX para blocos técnicos.
- [ ] Fechar campos por endpoint novo (`filtro`, `label`, `métrica`, `período`).
- [ ] Definir regra de "compatível": tolerância de diferença com Power BI.

### Etapa 2 - SQL/View (1-2 dias)
- [ ] Criar views de `perfil_ps`.
- [ ] Criar views de `fluxos_ps`.
- [ ] Criar views de `medicacao_ps`.
- [ ] Criar views de `conversao_ps_internacao`.
- [ ] Validar performance e filtro por `regional`, `unidade`, `period`.

### Etapa 3 - API Node (1 dia)
- [ ] Expor rotas em `/api/v1/ps/perfil/*`.
- [ ] Expor rotas em `/api/v1/ps/fluxos/*`.
- [ ] Expor rotas em `/api/v1/ps/medicacao/*`.
- [ ] Expor rotas em `/api/v1/ps/conversao/*`.
- [ ] Padronizar retorno `{ ok, data }`.

### Etapa 4 - Frontend (2 dias)
- [ ] Adicionar seções no `index.html` para os 4 blocos novos.
- [ ] Criar módulos JS para cada bloco.
- [ ] Conectar filtros globais existentes.
- [ ] Entregar versão navegável completa.

### Etapa 5 - Validação e Go-live (1 dia)
- [ ] Comparar números com Power BI (amostra por unidade e total).
- [ ] Ajustar divergências de cálculo.
- [ ] Executar smoke test dos endpoints críticos.
- [ ] Publicar versão final interna.

---

## Checklist de Execução do Agente
- [ ] Checklist de SQL concluído.
- [ ] Checklist de API concluído.
- [ ] Checklist de frontend concluído.
- [ ] Checklist de validação concluído.
- [ ] Release interna concluída.

## Definição de Pronto (Final)
- [ ] Os 4 blocos faltantes estão funcionais no Node.
- [ ] Filtros globais funcionam em todos os blocos novos.
- [ ] Diferenças vs Power BI documentadas e aceitas.
- [ ] Deploy interno realizado com sucesso.

## Histórico
- 2026-04-07: Plano inicial criado.
- 2026-04-07: Plano simplificado para fast-track de entrega.
