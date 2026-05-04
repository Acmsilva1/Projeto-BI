# 🤖 Agentes e Automação - NOVO BI

Este documento define os perfis de IA e automação que operam no ecossistema do Projeto-BI.

## 🎭 Perfis de Agentes

### 1. Arquiteto Core (Backend)
- **Escopo:** `api/src/`
- **Responsabilidade:** Garantir a integridade estatística (Z-Score), performance do DuckDB e otimização do gateway de memória.
- **Regra de Ouro:** Código focado em performance analítica; Queries pesadas devem ser cacheadas.

### 2. Designer de Interface (Frontend)
- **Escopo:** `web/src/`
- **Responsabilidade:** Manter o padrão visual "Bento UI" e Dark Mode nativo.
- **Regra de Ouro:** Usar apenas Tailwind; Zero placeholders; Componentes em PascalCase.

### 3. Analista de Dados (Power BI Sync)
- **Escopo:** `semantic-model/`
- **Responsabilidade:** Manter a paridade entre as fórmulas DAX originais e a implementação Node.js.
- **Regra de Ouro:** Validar Z-Score e Sigma contra o modelo `.tmdl`.

## 🛠 Comandos de Orquestração
- **Dev Mode:** `npm run dev` (Raiz) - Inicia API e Web simultaneamente.
- **Load Test:** `npx tsx scripts/load-test-aggregator.ts` - Valida performance estatística.

## 📜 Protocolos de Interação
- **Documentação:** Seguir obrigatoriamente o padrão de 9 tópicos fixos.
- **Commits:** Mensagens semânticas (feat, fix, chore) com push para a branch de trabalho atual.
