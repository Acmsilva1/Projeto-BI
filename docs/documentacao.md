# Documentação do Projeto BI

## 0. Identificação do artefato
- Projeto: `NOVO BI`
- Repositório: `Projeto-BI`
- Escopo desta documentação: visão consolidada de arquitetura, execução, qualidade e governança técnica.
- Fonte normativa de skill (externa ao repo):
  - `C:\projetos e aplicativos\regras do agente de IA\regras-gerais.md`
  - `C:\projetos e aplicativos\regras do agente de IA\backend.md`
  - `C:\projetos e aplicativos\regras do agente de IA\frontend.md`
  - `C:\projetos e aplicativos\regras do agente de IA\database.md`
  - `C:\projetos e aplicativos\regras do agente de IA\testes.md`

## 1. Resumo funcional e utilizadores impactados
O sistema entrega painéis analíticos hospitalares (jornada, gerencial e internação), com foco em indicadores operacionais e assistenciais. O consumo principal é por usuários internos de operação e gestão.

## 2. Superfícies, rotas e estrutura de navegação
- Frontend: `web/` (React + Vite + TypeScript)
- API: `api/` (Express + TypeScript)
- Painéis principais em `web/src/features/`:
  - `jornada/`
  - `gerencial/`
  - `internacao/`

## 3. Interface (frontend)
### Stack ativa
- React 19 + TypeScript
- Vite (porta padrão `5175`)
- ECharts, Recharts, Framer Motion

### Regras de implementação aplicadas (skill)
- Tipagem forte, sem acoplamento de regra de negócio na UI.
- Tratamento explícito de loading, erro e vazio em telas críticas.
- Componentização modular por feature.
- Gráficos priorizando ECharts (com Recharts já existente no projeto e mantido por compatibilidade local).

### Execução
- Desenvolvimento local: `npm run dev --prefix web`
- Build: `npm run build --prefix web`

## 4. Backend e contrato API
### Stack ativa
- Node.js 22
- Express 5
- TypeScript
- DuckDB

### Padrão arquitetural aplicado
- Organização por módulos em `api/src/features/`
- Separação por responsabilidades (controller/service)
- Acesso a dados centralizado por camada de dados da API

### Endpoints e operação
- Healthcheck: `/api/v1/health`
- Dashboard de medicação PS: `/api/v1/ps-medicacao`
- API em execução local: porta `3333`

### Execução
- Desenvolvimento local: `npm run dev --prefix api`
- Build: `npm run build --prefix api`

## 5. Persistência, dados e consultas
### Diretriz aplicada
- DuckDB como mecanismo preferencial para exploração analítica e validação técnica.
- Dados carregados por views/tabelas analíticas em memória para agregações de dashboard.

### Fontes de dados
- Datalake montado no container: `/datalake/hospital`
- Configuração via `CSV_DATA_DIR` e `DATA_GATEWAY=duckdb`

### Regra de governança
- Não expor dados sensíveis sem necessidade.
- Evitar logs com PII/PHI em texto puro.

## 6. Segurança, privacidade e conformidade
- Princípio do menor privilégio em acessos e permissões.
- Não versionar segredos.
- Logs e observabilidade sem dados pessoais identificáveis.
- Revisão ativa de aderência LGPD em mudanças de contrato e persistência.

## 7. Infraestrutura, ambiente e operações
### Docker Compose
Arquivo: `docker-compose.datalake.yml`

Serviços:
- `api` (porta `3333`)
- `web` (porta `5175`)

Montagens relevantes:
- Projeto: `./:/app`
- Datalake: `../../../datalake:/datalake:ro`
- Regras externas de IA: `../../../regras do agente de IA:/regras-agente:ro`

Variáveis relevantes:
- `AGENT_RULES_DIR=/regras-agente`
- `VITE_API_URL=http://localhost:3333`

Comandos:
- Subir: `npm run dev:docker`
- Derrubar: `npm run down:docker`

## 8. Qualidade, testes e gate obrigatório
### Regra mandatória de qualidade (skill)
- Nenhuma etapa avança sem teste aprovado da etapa anterior.
- Todo bug corrigido deve incluir teste de regressão.
- Feature crítica deve possuir teste de integração.

### Testes ativos no projeto
- Paridade de metas: `npm run test:parity-metas --prefix api`
- Agregador de medicação PS: `npm run test:medicacao-ps-aggregator --prefix api`
- Build consolidado: `npm run build`

### Pipeline mínimo recomendado
1. Lint (quando configurado)
2. Testes unitários
3. Testes de integração
4. Build de `api` e `web`
5. Smoke de endpoints críticos (`/api/v1/health`, `/api/v1/ps-medicacao`)

## 9. Convenções de trabalho para este repositório
- Priorizar mudanças incrementais e testáveis.
- Manter documentação técnica atualizada no mesmo ciclo da entrega.
- Registrar impactos em backend, frontend e dados antes de merge.
- Em falha repetida, limitar tentativa autônoma e escalar decisão.

## 10. Observações finais
- Este diretório `docs/` deve conter apenas este arquivo consolidado: `documentacao.md`.
- As regras de skill são externas ao repositório e devem ser sempre lidas pelo caminho montado em ambiente Docker (`/regras-agente`) ou caminho host equivalente.

Documento revisado em 2026-05-06.
