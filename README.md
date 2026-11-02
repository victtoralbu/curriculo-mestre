# Currículo Mestre — SaaS de Candidaturas e Currículos com IA

Plataforma web responsiva (**Mobile-First**, tipografia **Roboto**) para organização de trajetória profissional, análise de oportunidades de emprego, compatibilidade ATS, geração ética de currículos personalizados (sem alucinações) via **Google Gemini API (`@google/genai`)**, exportação em **DOCX e PDF** e carteira financeira com cotas gratuitas, contribuição mensal, crédito de confiança e cupons promocionais.

---

## 1. Arquitetura e Stack Técnica

- **Frontend & Backend:** Next.js 15 (App Router) + React 19 + TypeScript
- **Design & Tipografia:** Tailwind CSS (Mobile-First obrigatório) + Fonte Google **Roboto** padronizada
- **Banco de Dados:** PostgreSQL (`pg` + migrations versionadas em `prisma/migrations`) com suporte a banco PostgreSQL 16 embarcado (`@electric-sql/pglite`) para execução local imediata e testes automatizados determinísticos
- **Inteligência Artificial:** Google Gemini API (`@google/genai`, configurável via `GEMINI_MODEL`, padrão `gemini-2.5-flash`) exclusivamente no backend
- **Exportação de Documentos:** `docx` (`.docx` nativo de coluna única ATS) e `pdf-lib` (`.pdf` de coluna única ATS)
- **Autenticação & Segurança:** Sessões JWT assinadas (`jose`) em cookies `HttpOnly`, hash `bcryptjs`, isolamento estrito por `user_id`, RBAC (`USER`/`ADMIN`), rate limiting e exclusão completa de dados conforme a LGPD
- **Testes Automatizados:** Vitest (`src/tests/saas-rules.test.ts`) cobrindo todos os 22 cenários críticos do PRD

---

## 2. Instalação e Execução Local

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Configurar variáveis de ambiente:**
   Copie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
   Preencha `GEMINI_API_KEY` e `AUTH_SECRET`. Caso `DATABASE_URL` seja deixado em branco no ambiente local, o sistema inicializa automaticamente o motor PostgreSQL 16 embarcado em `.pglite/data` com todas as tabelas, índices e cupons iniciais (`BETA10`, `BETA30`, `BETA100`, `FUNDADOR30`).

3. **Executar os testes automatizados:**
   ```bash
   npm test
   ```

4. **Iniciar o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```
   Acesse `http://localhost:3000`.
   - Conta administrativa inicial (seed): `admin@curriculomestre.com.br` / senha: `Admin@2026`

---

## 3. Instruções de Deploy no Railway

Como o Railway exige conteúdo no repositório GitHub antes da criação do serviço de aplicação:

1. **Repositório GitHub conectado:**
   `https://github.com/victtoralbu/curriculo-mestre`

2. **Criar Projeto no Railway:**
   - Acesse o painel do [Railway](https://railway.app) e clique em **New Project** -> **Deploy from GitHub repo** -> selecione `victtoralbu/curriculo-mestre`.
   - No mesmo projeto do Railway, clique em **+ New** -> **Database** -> **Add PostgreSQL**.

3. **Configurar Variáveis de Ambiente no Serviço da Aplicação no Railway:**
   - `NODE_ENV="production"`
   - `DATABASE_URL="${{Postgres.DATABASE_URL}}"` (referência automática ao banco PostgreSQL do Railway)
   - `AUTH_SECRET="<gere-uma-string-aleatoria-segura-de-64-caracteres>"`
   - `ADMIN_EMAIL="admin@curriculomestre.com.br"`
   - `GEMINI_API_KEY="<sua-chave-gemini-api>"`
   - `GEMINI_MODEL="gemini-2.5-flash"`
   - `PAYMENT_WEBHOOK_SECRET="<segredo-hmac-para-webhooks>"`
   - `MERCADOPAGO_ACCESS_TOKEN="<token-de-producao-quando-disponivel>"`

4. **Migrations e Inicialização Automática:**
   - Na primeira conexão ao PostgreSQL do Railway, o módulo `ensureDbInitialized()` aplica de forma idempotente o schema de `prisma/migrations/20261102000000_init/migration.sql` e popula `system_settings` e os cupons iniciais (`BETA10`, `BETA30`, `BETA100`, `FUNDADOR30`).
   - Opcionalmente, você também pode configurar o comando de deploy no Railway como `npm run db:migrate && npm run start`.
