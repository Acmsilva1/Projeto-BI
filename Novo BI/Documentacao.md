# Documentação - Hospital BI (Node.js + React)

Esta documentação reflete a nova arquitetura 100% JavaScript do Hospital BI.
A aplicação agora utiliza Node.js para interface com o PostgreSQL + Redis + RabbitMQ, e React + Vite no frontend para entregar dashboards interativos no padrão Power BI.

## Requisitos de Sistema
- Node.js v18+ 
- Docker Compose (para Redis e RabbitMQ)
- Python 3.10+ (Apenas para o guardião do repositório)

## Stack Tecnológica
- **Backend:** Node.js (Express), pg (PostgreSQL), amqplib (RabbitMQ), redis.
- **Frontend:** React 18, Vite 8, TailwindCSS, ECharts (via echarts-for-react), Lucide React.
- **Banco de Dados:** PostgreSQL (Tabelas fato e views em `sql/database/`).

## Estrutura de Diretórios
```
.
├── backend/                  # Servidor Express.js (Maestro)
│   ├── infra/                # Serviços RabbitMQ e Redis
│   ├── db.js                 # Pool de conexão PostgreSQL
│   ├── live_service.js       # Lógica centralizada de negócio e cache
│   └── server.js             # Entrypoint da API e definição de rotas
├── frontend/                 # Aplicação React (SPA)
│   ├── src/                  # Código-fonte React
│   │   ├── components/       # Componentes reaproveitáveis (Charts, KpiCard, Layouts)
│   │   │   ├── charts/       # DynamicChart (Troca de barra/linha/pizza via hover)
│   │   │   └── sections/     # Módulos do Dashboard (Overview, PS, CC, etc.)
│   │   ├── hooks/            # Custom hooks (Ex: useApi.js)
│   │   ├── index.css         # Reset global e classes utilitárias baseadas em Tailwind
│   │   ├── App.jsx           # Shell principal (Roteamento simples, controle de estados)
│   │   └── main.jsx          # Entrypoint do React
│   ├── index.html            # Template base do Vite
│   ├── tailwind.config.js    # Config do Tailwind (.js ESM)
│   └── vite.config.js        # Config principal do Vite e alias
├── sql/                      # Scripts e objetos do banco
│   └── database/             # Views, Tópicos Fato e Tabelas Dimensão separadas por arquivos (Controle de Versão Unitário)
├── docker-compose.yml        # Configuração da Infraestrutura (Redis + RabbitMQ)
├── pipeline_guard.py         # Script Python do CI/CD (Garante cobertura de código e padronização)
└── pipeline_guard_config.json# Arquivo de config do pipeline local
```

## Guia Rápido de Execução

### 1. Iniciar Infraestrutura
Suba os serviços locais (RabbitMQ + Redis) usando o script npm da pasta `frontend`:
```cmd
cd "Novo BI/frontend"
npm run infra:up
```

### 2. Instalar Dependências Frontend
*O backend dispensa a pasta node_modules própria para uso em nuvem, rodando os scripts diretamente com o do frontend onde as dependências pesadas ficam.*
```cmd
cd "Novo BI/frontend"
npm i
```

### 3. Rodar o Ambiente Local (Dev)
Inicia de forma simultânea o `server.js` do Node e o `vite` dev-server do React. (A API responde na `3001` e o Vite faz proxy para ela devidamente):
```cmd
cd "Novo BI/frontend"
npm run dev
```

### 4. Build de Produção
Para fins de otimização em release:
```cmd
cd "Novo BI/frontend"
npm run build
```
O framework do Vite (`npm run build`) gerará as saídas minificadas, quebrando os chunks apropriadamente (ex. extração limpa do Echarts/React para cache).
