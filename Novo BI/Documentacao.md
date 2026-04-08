# Documentação do Projeto - Hospital BI MVC

Este projeto é uma plataforma de Business Intelligence para gestão hospitalar, focada em performance e real-time data.

## 🏗️ Arquitetura (Padrão DevOps)

A estrutura segue a organização simplificada e modular:

-   **/frontend**: Interface do usuário (React + Vite + Tailwind CSS).
-   **/backend**: Lógica de integração e serviços (Node.js Maestro + Python Nerd no Porão).
-   **/sql**: Inteligência de dados, incluindo Views, Functions e Migrations.
-   **/logs**: Arquivos de auditoria LGPD, logs de sistema e eventos jsonl.
-   **/docs**: Documentação técnica adicional.

## 🛠️ Tech Stack

### Frontend
- **Framework**: React.js
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Porta Padrão**: 1573

### Backend
- **Node.js (Maestro)**: Express.js, ioredis, amqplib, pg.
- **Python (Nerd no Porão)**: FastAPI, Scripts de automação.
- **Database**: PostgreSQL (Via Supabase ou Local).
- **Cache**: Redis.
- **Message Broker**: RabbitMQ.

### DevOps & Monitoring
- **Orquestração**: Docker Compose.
- **Segurança**: Auditoria LGPD integrada.
- **Monitoramento**: Pipeline Guard (Python) para integridade de dados.

## 🚀 Como Executar

### Pré-requisitos
- Node.js installed
- Docker & Docker Compose
- Teoria Python 3.10+

### Comandos Principais (na pasta /frontend)
- `npm run dev`: Inicia frontend, backend e watchers de CSS simultaneamente.
- `npm run infra:up`: Sobe Redis e RabbitMQ via Docker.
- `npm run pipeline:watch`: Inicia o monitoramento da integridade da pipeline.

---
Mantido por: Agente DevOps Antigravity
Última Atualização: Abril 2026
