# ⚙️ SKILL: THE BACKEND ORCHESTRATOR (SOLO AGENT)

## 🏗️ ARQUITETURA DE DECISÃO (QUANDO USAR O QUÊ)
Sempre que este arquivo for lido, direcione a stack com base no objetivo da tarefa:

1. **NODE.JS (O Carro-Chefe):** Use para APIs REST, interações de usuário em tempo real, CRUDs do Super App e integrações de sistema (ERPs).
2. **PYTHON (O Especialista):** Use para scripts de IA, processamento de dados (Analytics), automações complexas (n8n custom nodes), scraping ou cálculos matemáticos pesados.

---

## 🟢 STACK NODE.JS: INTERAÇÃO E FLUXO
- **Runtime:** Node.js (LTS).
- **Framework:** Express (Minimalista) ou Fastify (Performance).
- **Linguagem:** TypeScript (Sempre).
- **ORM/Query Builder:** Prisma (para produtividade) ou Knex.js (para consultas SQL complexas/hospitalares).
- **Comunicação:** Socket.io para atualizações em tempo real (essencial para Censo Hospitalar).
- **Autenticação:** JWT (JSON Web Tokens) com Refresh Tokens.
- **Validação:** Zod (Sincronizado com o Schema do Frontend).

---

## 🐍 STACK PYTHON: IA E DATA SCIENCE
- **Ambiente:** Python 3.10+ (Ambientes virtuais isolados).
- **Processamento de Dados:** Pandas e NumPy (O arroz com feijão do Analytics).
- **IA/ML:** Scikit-learn para predições simples e integração com LangChain/OpenAI SDK para agentes de IA.
- **API (Se necessário):** FastAPI (Rápido, moderno e com documentação Swagger automática).
- **Automação:** Selenium ou Playwright para monitoramento de portais (ex: Vigia PMVV).
- **Database Driver:** SQLAlchemy ou integração direta com PostgreSQL.

---

## 🗄️ PERSISTÊNCIA E INFRA (PADRÃO DEVOPS)
- **Banco de Dados:** PostgreSQL (Relacional principal).
- **Cache:** Redis (para performance em filas e sessões).
- **Container:** Docker (Todo projeto deve ter um `Dockerfile` e um `docker-compose.yml` otimizados).
- **Logs:** Winston ou Morgan para Node.js; Logging nativo para Python. **Regra LGPD:** Nunca logue corpos de requisição que contenham dados de pacientes ou financeiros sem hash.

---

## ⚙️ REGRAS DE OURO BACKEND
1. **Tratamento de Erros:** Global Error Handler em Node; Try/Except estruturado em Python. Nunca retorne stack traces para o cliente.
2. **Arquitetura:** Controller para rotas, Service para lógica de negócio, Repository para dados.
3. **Economia de Tokens:** Não gere scripts de migração de banco gigantescos a menos que solicitado. Seja direto no SQL.
4. **Segurança:** Cabeçalhos Helmet, proteção contra SQL Injection e Rate Limiting configurados por padrão.

---
## 🛑 PROTOCOLO DE CONFLITO
Se o Mestre pedir para fazer Analytics pesado em Node.js, questione: "Mestre, não seria mais eficiente mover essa lógica para um microserviço em Python conforme nossa Skill de Backend?"
