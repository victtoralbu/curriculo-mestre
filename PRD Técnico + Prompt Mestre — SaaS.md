PRD Técnico + Prompt Mestre — Currículo Mestre (SaaS de Candidaturas e Currículos com IA)

Versão: 1.1 — MVP
Status: Especificação oficial para desenvolvimento
Nome do Produto: Currículo Mestre
Repositório GitHub: https://github.com/victtoralbu/curriculo-mestre
Ambiente previsto: Railway + PostgreSQL + Google Antigravity + Google Gemini API

PARTE 1 — PRD TÉCNICO

1. Visão do produto

Desenvolver uma plataforma web que ajude profissionais a organizar sua trajetória profissional, analisar oportunidades de emprego e produzir candidaturas personalizadas com auxílio de inteligência artificial.

O produto deverá democratizar o acesso a ferramentas de orientação profissional e preparação de currículos, mantendo as funcionalidades essenciais acessíveis gratuitamente.

O modelo financeiro será baseado em contribuições acessíveis, créditos de utilização e tolerância limitada para uso sem saldo.

1.1 Objetivos do MVP

Permitir que o usuário construa um perfil profissional reutilizável.

Analisar vagas de emprego a partir de textos ou links.

Identificar compatibilidade entre perfil e vaga.

Gerar currículos personalizados e compatíveis com sistemas ATS.

Permitir exportação em DOCX e PDF.

Controlar candidaturas gratuitas, créditos, contribuições e pendências.

Disponibilizar cupons promocionais para os primeiros testadores.

Fornecer um painel administrativo para acompanhar o produto e sua sustentabilidade financeira.

1.2 Público-alvo

Pessoas em busca do primeiro emprego.

Profissionais em transição de carreira.

Pessoas desempregadas ou buscando recolocação.

Profissionais que desejam mudar de empresa ou área.

Pessoas que precisam adaptar seus currículos para diferentes oportunidades.

1.3 Proposta de valor

Um assistente de carreira acessível que transforma experiências profissionais em candidaturas mais estratégicas, personalizadas e bem apresentadas.

2. Escopo funcional

2.1 Cadastro e autenticação

O usuário deverá conseguir:

Criar uma conta com nome, e-mail e senha.

Entrar e sair da plataforma.

Recuperar a senha.

Editar informações básicas.

Solicitar exclusão da conta e dos dados associados.

Visualizar seu histórico de atividades.

Requisitos:

Autenticação segura.

Senhas armazenadas com hash seguro.

Sessões protegidas.

Isolamento dos dados entre usuários.

Possibilidade de autenticação social em versão futura.

2.2 Perfil profissional

Será o principal cadastro reutilizável do usuário.

O sistema deverá permitir registrar:

Dados pessoais

Nome completo.

Cidade e estado.

E-mail.

Telefone.

LinkedIn.

Portfólio ou site.

Resumo profissional

Objetivo profissional.

Áreas de atuação.

Tempo de experiência.

Principais especialidades.

Experiências profissionais

Empresa.

Cargo.

Tipo de contratação.

Data inicial e final.

Descrição das atividades.

Resultados e indicadores.

Ferramentas utilizadas.

Formação acadêmica

Instituição.

Curso.

Grau de formação.

Período.

Situação.

Competências

Competências técnicas.

Competências comportamentais.

Ferramentas.

Idiomas.

Certificações.

O usuário poderá editar, adicionar ou excluir informações.

Regra fundamental: a IA não poderá inventar experiências, resultados, conhecimentos, cargos, certificações ou competências. Quando faltarem informações, deverá solicitar complementação ou omitir o dado.

2.3 Importação de currículo

Permitir futuramente o envio de arquivos DOCX e PDF para extração de informações.

Para o MVP, a importação poderá ser implementada como funcionalidade inicial, desde que não comprometa o cronograma das funcionalidades principais.

O sistema deverá:

Receber o arquivo.

Extrair o texto.

Identificar informações profissionais.

Organizar os dados nos campos do perfil.

Apresentar os dados para revisão.

Solicitar confirmação antes de salvar.

A extração não deverá sobrescrever automaticamente informações já existentes.

2.4 Análise de vagas

O usuário poderá informar uma oportunidade por:

Texto da descrição da vaga.

Link da oportunidade.

Conteúdo copiado de uma plataforma de recrutamento.

A análise deverá identificar:

Cargo.

Empresa, quando disponível.

Responsabilidades.

Requisitos obrigatórios.

Requisitos desejáveis.

Competências técnicas.

Competências comportamentais.

Ferramentas e tecnologias.

Formação e experiência exigidas.

Palavras-chave relevantes para ATS.

Atenção: links de plataformas externas podem exigir autenticação, bloquear robôs ou não permitir extração automática. Nesse caso, o sistema deverá solicitar que o usuário cole a descrição da vaga. Nunca deverá fingir que conseguiu acessar um conteúdo indisponível.

2.5 Inteligência de compatibilidade

Comparar a vaga com o perfil profissional.

A análise deverá apresentar:

Compatibilidade geral

Indicador percentual estimado.

Justificativa do resultado.

Principais pontos de aderência.

Pontos fortes

Experiências relacionadas.

Competências compatíveis.

Resultados relevantes.

Ferramentas e conhecimentos aderentes.

Lacunas

Requisitos não encontrados no perfil.

Competências que precisam ser desenvolvidas.

Informações que precisam ser confirmadas.

Recomendações

Experiências que merecem maior destaque.

Palavras-chave que devem aparecer no currículo.

Informações adicionais que podem fortalecer a candidatura.

O percentual de compatibilidade deverá ser apresentado como estimativa orientativa, não como previsão da decisão do recrutador ou probabilidade real de contratação.

2.6 Geração de currículo personalizado

A plataforma deverá utilizar o perfil profissional e a análise da vaga para gerar uma versão personalizada do currículo.

O resultado deverá:

Priorizar experiências relevantes.

Ajustar o resumo profissional.

Destacar competências relacionadas à vaga.

Utilizar palavras-chave relevantes de maneira natural.

Valorizar resultados mensuráveis.

Organizar o conteúdo de forma objetiva.

Manter linguagem profissional.

Preservar a veracidade das informações.

Evitar excesso de elementos gráficos que prejudiquem a leitura por ATS.

O usuário deverá conseguir revisar e editar o conteúdo antes da exportação.

Formatos de exportação:

DOCX.

PDF.

O currículo deverá utilizar uma estrutura profissional, preferencialmente de uma coluna, com títulos claros e sem elementos que prejudiquem a extração de texto.

2.7 Histórico de candidaturas

Cada candidatura deverá possuir:

Identificação da vaga.

Empresa.

Cargo.

Data de criação.

Análise de compatibilidade.

Currículo gerado.

Status.

Créditos utilizados.

Origem do crédito.

Status sugeridos:

Em preparação.

Currículo gerado.

Candidatado.

Em processo seletivo.

Aprovado.

Reprovado.

Encerrado.

O usuário poderá consultar candidaturas anteriores e reutilizar informações.

Regra de contabilização: uma candidatura corresponde a uma geração concluída de currículo personalizado para uma oportunidade. Visualizações, edições, downloads e consultas ao histórico não devem gerar novas cobranças.

Se uma geração falhar tecnicamente, nenhum crédito ou candidatura deverá ser consumido.

3. Modelo comercial e financeiro

3.1 Regras de utilização

Modalidade

Benefício

Gratuito

3 candidaturas por mês

Contribuição mensal

R$ 3,00 para até 30 candidaturas no mês

Uso adicional

R$ 0,10 por candidatura

Contribuição livre

Valor escolhido pelo usuário, convertido em saldo

Uso sem saldo

Até 100 candidaturas adicionais pendentes em 30 dias

Prazo de regularização

30 dias por pendência

A contribuição mensal de R$ 3,00 libera até 30 candidaturas no total do mês, incluindo as três que já seriam gratuitas.

O sistema deverá manter os limites em configurações administrativas, evitando valores fixos espalhados pelo código.

3.2 Regra de prioridade dos créditos

Ao gerar uma candidatura, o backend deverá verificar nesta ordem:

Créditos promocionais válidos.

Cota gratuita mensal disponível.

Cota mensal de contribuição, quando habilitada.

Saldo positivo da carteira.

Crédito de utilização pendente, respeitando o limite de confiança.

Bloqueio por falta de disponibilidade.

A prioridade deverá ser configurável pelo administrador.

3.3 Carteira de contribuições

Cada usuário terá uma carteira digital interna.

Exemplo:

Movimentação

Valor

Contribuição recebida

+ R$ 10,00

Candidatura adicional

- R$ 0,10

Candidatura adicional

- R$ 0,10

Saldo disponível

R$ 9,80

A carteira deverá permitir:

Receber contribuições.

Consultar saldo.

Consultar extrato.

Consultar débitos.

Consultar pendências.

Visualizar vencimentos.

O saldo será exclusivo para utilização dentro da plataforma. Não será uma conta bancária, não terá saque e não poderá ser transferido entre usuários.

3.4 Pendências financeiras

Quando o usuário não possuir saldo suficiente:

O sistema poderá liberar a candidatura adicional.

Será registrado um débito de R$ 0,10.

Cada débito terá data de criação e vencimento.

O prazo será de 30 dias a partir da utilização.

O débito ficará visível no extrato.

Limite de confiança

O usuário poderá acumular até 100 candidaturas adicionais sem contribuição em uma janela móvel de 30 dias.

Isso representa até R$ 10,00 em pendências, considerando R$ 0,10 por candidatura.

Ao atingir o limite:

Novas candidaturas que gerem débito serão bloqueadas.

O usuário poderá continuar utilizando créditos gratuitos ou promocionais disponíveis.

Uma contribuição poderá regularizar os débitos e, se houver excedente, gerar saldo positivo.

Regularização

Quando o usuário realizar uma contribuição:

O pagamento deverá ser confirmado pelo provedor.

O sistema deverá localizar as pendências mais antigas.

O valor recebido será utilizado primeiro para regularizar débitos vencidos ou pendentes, seguindo ordem cronológica.

O excedente será convertido em saldo positivo.

O extrato deverá registrar todas as movimentações.

O sistema deverá impedir cobrança duplicada e processamento repetido de notificações de pagamento.

Decisão de produto: a política de bloqueio após 30 dias de inadimplência deverá ser configurável. No primeiro teste, poderemos observar a inadimplência antes de implementar bloqueios adicionais além do limite de 100 usos.

3.5 Cupons promocionais

Criar um módulo de cupons com gerenciamento administrativo.

Cupons iniciais

Código

Benefício

BETA10

10 candidaturas adicionais

BETA30

30 candidaturas adicionais

BETA100

100 candidaturas adicionais

FUNDADOR30

Acesso ampliado por 30 dias

Os benefícios são exemplos de configuração inicial e deverão poder ser alterados pelo administrador.

Regras dos cupons

Cada cupom deverá possuir:

Código único.

Descrição.

Tipo de benefício.

Quantidade de créditos.

Data de início.

Data de expiração.

Limite total de resgates.

Limite por usuário.

Status ativo/inativo.

Identificação de quem resgatou.

Data e hora do resgate.

Tipos de benefício:

Créditos de candidatura.

Ampliação temporária de limite.

Acesso promocional por período determinado.

Cupons promocionais não poderão:

Gerar saldo financeiro.

Ser convertidos em dinheiro.

Ser transferidos entre contas.

Gerar pendências financeiras.

O resgate deverá ser validado no backend e executado de forma atômica.

3.6 Pagamentos

Criar uma camada de integração independente do provedor de pagamento.

A plataforma deverá permitir integração com um gateway de pagamentos que ofereça Pix e notificações de confirmação.

A integração deverá contemplar:

Criação de pagamento.

Identificação do usuário.

Identificação da contribuição.

Valor.

Status.

Data de confirmação.

Identificador externo da transação.

Webhook de confirmação.

Tratamento de falhas.

Idempotência.

Não considerar uma contribuição recebida apenas porque o usuário visualizou ou retornou da página de pagamento. A confirmação deverá vir do provedor.

A integração com Mercado Pago poderá ser avaliada para o MVP, mas as credenciais e tarifas deverão ser confirmadas antes da ativação em produção.

4. Arquitetura técnica

4.1 Stack recomendada

Camada

Tecnologia

Frontend

Next.js + React + TypeScript

Interface e Tipografia

Tailwind CSS (Design Mobile-First obrigatório) + Fonte Roboto padronizada em todo o aplicativo

Backend

API com TypeScript

Banco de dados

PostgreSQL

ORM

Prisma ou Drizzle

Hospedagem

Railway

IA

Google Gemini API (@google/genai)

Autenticação

Solução segura integrada ao backend

Arquivos

Armazenamento privado de documentos

Exportação

Geração de DOCX e PDF

Pagamentos

Gateway com Pix e webhooks

Versionamento

GitHub

Desenvolvimento

Google Antigravity

O Antigravity deverá primeiro inspecionar o ambiente já existente e aproveitar tecnologias e serviços que estejam funcionando. Não deverá substituir a stack sem justificativa técnica.

4.2 Estrutura sugerida de módulos

src/
├── app/
│   ├── (auth)/
│   ├── dashboard/
│   ├── profile/
│   ├── applications/
│   ├── wallet/
│   ├── history/
│   └── admin/
│
├── components/
│   ├── ui/
│   ├── dashboard/
│   ├── profile/
│   ├── applications/
│   ├── wallet/
│   └── admin/
│
├── modules/
│   ├── authentication/
│   ├── professional-profile/
│   ├── job-analysis/
│   ├── compatibility/
│   ├── resume-generation/
│   ├── billing/
│   ├── wallet/
│   ├── coupons/
│   └── administration/
│
├── services/
│   ├── gemini/
│   ├── payments/
│   ├── documents/
│   └── storage/
│
├── lib/
├── types/
└── config/

A estrutura poderá ser adaptada à arquitetura já existente no repositório.

5. Modelagem do banco de dados

O banco deverá utilizar PostgreSQL.

5.1 Entidades principais

users

id

name

email

password_hash ou identificador do provedor de autenticação

role

status

created_at

updated_at

professional_profiles

id

user_id

professional_summary

target_roles

location

linkedin_url

portfolio_url

created_at

updated_at

professional_experiences

id

profile_id

company

position

employment_type

start_date

end_date

description

achievements

tools

educations

id

profile_id

institution

course

degree

start_date

end_date

status

skills

id

profile_id

name

category

proficiency

jobs

id

user_id

company

position

description

source_url

extracted_requirements

created_at

applications

id

user_id

job_id

compatibility_score

analysis

resume_content

status

usage_transaction_id

created_at

wallets

id

user_id

balance

created_at

updated_at

wallet_transactions

id

wallet_id

user_id

type

amount

description

reference_type

reference_id

created_at

usage_ledger

id

user_id

application_id

usage_type

amount

source

status

created_at

debts

id

user_id

application_id

amount

status

created_at

due_at

settled_at

coupons

id

code

benefit_type

benefit_value

max_redemptions

max_per_user

starts_at

expires_at

active

created_at

coupon_redemptions

id

coupon_id

user_id

credits_granted

created_at

promotional_credits

id

user_id

source

original_amount

remaining_amount

expires_at

created_at

payments

id

user_id

provider

external_payment_id

amount

status

confirmed_at

created_at

system_settings

id

key

value

updated_at

audit_logs

id

actor_user_id

action

entity

entity_id

metadata

created_at

5.2 Regras de integridade

Todas as tabelas de dados pessoais devem possuir relacionamento com o usuário responsável.

Consultas devem respeitar a propriedade dos dados.

Operações financeiras devem utilizar transações no banco.

Valores financeiros devem ser armazenados em centavos, utilizando inteiros.

A carteira não poderá ser atualizada sem registro correspondente no extrato.

Débitos e créditos deverão possuir histórico imutável de movimentação.

IDs externos de pagamentos deverão ser únicos quando aplicável.

Webhooks deverão possuir controle de idempotência.

O sistema deverá impedir consumo duplicado de créditos em requisições simultâneas.

Observação técnica: a carteira poderá exibir o saldo agregado, mas o extrato e o ledger deverão ser a fonte auditável das movimentações. Não depender exclusivamente de um campo de saldo editável.

6. Regras de segurança e LGPD

A plataforma armazenará dados pessoais e profissionais. Portanto, deverá considerar a Lei Geral de Proteção de Dados.

Requisitos:

Política de privacidade.

Termos de uso.

Consentimento e transparência sobre tratamento de dados.

Coleta apenas dos dados necessários.

Exclusão de conta e dados conforme política de retenção aplicável.

Controle de acesso por usuário.

Proteção de rotas administrativas.

Criptografia em trânsito.

Segredos armazenados em variáveis de ambiente.

Proteção contra exposição de chaves da Gemini API (GEMINI_API_KEY).

Validação de entradas.

Limitação de requisições.

Registro de eventos críticos.

Backup do banco.

Proteção de documentos enviados.

Política de retenção e descarte de arquivos.

Os dados dos usuários não poderão ser utilizados para treinar ou compartilhar perfis entre contas.

A IA deverá receber apenas as informações necessárias para a tarefa solicitada.

7. Controle de custos de IA

A plataforma deverá possuir uma camada centralizada para consumo da Google Gemini API (@google/genai).

Requisitos:

Modelo configurável por variável de ambiente.

Limite de tokens por operação.

Limite de requisições por usuário.

Registro de tokens de entrada e saída.

Registro do custo estimado por candidatura.

Tratamento de erros e tentativas.

Reutilização do perfil profissional estruturado.

Evitar enviar documentos completos quando apenas parte das informações for necessária.

Indicadores financeiros

Custo médio de IA por candidatura.

Custo total de IA.

Custo por usuário ativo.

Candidaturas gratuitas.

Candidaturas com créditos promocionais.

Candidaturas pagas.

Candidaturas com débito pendente.

Receita de contribuições.

Saldo de carteiras.

Pendências financeiras.

Percentual de regularização.

O custo deverá ser calculado a partir do modelo e dos preços configurados, não de um valor fixo presumido.

8. Experiência do usuário e telas

8.0 Diretrizes obrigatórias de Design, Mobile-First e Tipografia

Design Mobile-First: Toda tela, componente, formulário, tabela e modal deverá ser projetado e validado primeiramente para dispositivos móveis (telas a partir de 320px/375px) e expandido progressivamente para tablets e desktops (breakpoints sm, md, lg, xl).

Regra de validação em desenvolvimento: Em todas as rotinas de desenvolvimento e revisão de interface, é obrigatório validar ausência de rolagem horizontal indevida, áreas de toque mínimas adequadas (44x44px), navegação mobile intuitiva (bottom bar / drawer responsivo) e legibilidade em telas pequenas.

Padronização Tipográfica: A fonte Roboto (Google Fonts) deverá ser utilizada de forma padronizada em todo o aplicativo (textos, títulos, botões, formulários, dashboards e documentos), mantendo hierarquia visual clara e profissional.

8.1 Landing page

Apresentar:

Proposta de valor.

Como funciona.

Principais benefícios.

Demonstração do processo.

Chamada para cadastro.

Explicação do modelo gratuito e de contribuição.

8.2 Dashboard

Exibir:

Saudação ao usuário.

Quantidade de candidaturas realizadas no mês.

Cota gratuita disponível.

Créditos promocionais disponíveis.

Saldo da carteira.

Pendências, quando houver.

Botão para nova candidatura.

Últimas candidaturas.

8.3 Perfil profissional

Tela para cadastrar e editar todas as informações profissionais.

Utilizar etapas ou abas para facilitar o preenchimento.

8.4 Nova candidatura

Fluxo:

Informar a vaga.

Analisar a descrição.

Comparar com o perfil.

Apresentar pontos fortes e lacunas.

Gerar currículo personalizado.

Revisar e editar.

Exportar DOCX ou PDF.

Registrar a candidatura no histórico.

8.5 Carteira

Exibir:

Saldo disponível.

Créditos promocionais.

Quantidade de candidaturas utilizadas.

Pendências.

Datas de vencimento.

Extrato.

Botão de contribuição.

Opção de contribuição livre.

8.6 Cupons

Tela para o usuário inserir um código promocional e visualizar o benefício recebido.

8.7 Painel administrativo

O administrador deverá conseguir:

Visualizar usuários.

Consultar utilização.

Consultar custos de IA.

Gerenciar cupons.

Gerenciar créditos.

Consultar contribuições.

Consultar pagamentos.

Consultar pendências.

Consultar inadimplência.

Alterar parâmetros comerciais.

Bloquear ou desbloquear usuários.

Visualizar indicadores financeiros.

9. Critérios de aceite do MVP

O produto somente será considerado pronto para testes quando:

Um usuário conseguir criar uma conta e entrar.

Conseguir cadastrar e editar seu perfil profissional.

Conseguir informar uma descrição de vaga.

Conseguir visualizar uma análise de compatibilidade.

Conseguir gerar um currículo personalizado.

Conseguir revisar e exportar DOCX e PDF.

Conseguir consultar seu histórico.

O sistema liberar corretamente as três candidaturas gratuitas mensais.

O sistema aplicar corretamente a contribuição de R$ 3 para até 30 candidaturas mensais.

O sistema descontar R$ 0,10 por candidatura adicional.

O sistema registrar pendências sem saldo.

O limite de 100 utilizações pendentes em 30 dias ser respeitado.

Os débitos possuírem vencimento individual de 30 dias.

O usuário conseguir realizar contribuições e consultar seu extrato.

O sistema liquidar débitos e atualizar o saldo corretamente.

O administrador conseguir criar e gerenciar cupons.

Os cupons liberarem créditos sem gerar dívidas.

O sistema impedir o uso duplicado de créditos.

O sistema impedir que um usuário acesse dados de outro.

O administrador conseguir visualizar indicadores básicos de uso e custos.

Testes obrigatórios

Usuário sem perfil.

Usuário com perfil completo.

Três candidaturas gratuitas no mês.

Quarta candidatura sem contribuição.

Contribuição de R$ 3.

Trigésima candidatura do mês.

Trigésima primeira candidatura.

Uso com saldo positivo.

Uso sem saldo.

Atingimento de 100 pendências.

Regularização parcial.

Regularização total.

Pendência vencida.

Cupom válido.

Cupom expirado.

Cupom com limite de resgates atingido.

Cupom utilizado duas vezes.

Falha na geração do currículo.

Falha na confirmação do pagamento.

Webhook duplicado.

Requisições simultâneas.

Tentativa de acesso a dados de outro usuário.

10. Fases de desenvolvimento

Fase 1 — Fundação

Configuração do projeto.

Banco de dados.

Autenticação.

Estrutura de usuários.

Layout principal.

Fase 2 — Inteligência de carreira

Perfil profissional.

Cadastro de experiências.

Análise de vagas.

Compatibilidade.

Geração de currículo.

Fase 3 — Documentos

Editor de currículo.

Exportação DOCX.

Exportação PDF.

Histórico de candidaturas.

Fase 4 — Financeiro

Carteira.

Extrato.

Cotas gratuitas.

Contribuição mensal.

Créditos adicionais.

Pendências.

Limites de confiança.

Fase 5 — Cupons e administração

Gestão de cupons.

Resgate.

Créditos promocionais.

Painel administrativo.

Indicadores.

Fase 6 — Homologação

Testes de regras comerciais.

Testes de segurança.

Testes de concorrência.

Testes de custo.

Correções.

Liberação do beta.