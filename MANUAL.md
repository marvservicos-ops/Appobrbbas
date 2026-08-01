# Manual do Sistema — MARV Gestão

Sistema de gestão de obras, estoque, funcionários, manutenções e financeiro, construído em Next.js 14 (App Router) + Supabase.

> Este manual foi gerado a partir de uma revisão do código-fonte em 2026-07-31. Ele documenta o que o sistema faz e como está estruturado — não substitui uma auditoria de segurança nem o schema definitivo do banco (algumas tabelas foram criadas fora dos arquivos `.sql` versionados no repositório; veja seção 12).

## Sumário
1. [Visão geral e autenticação](#1-visão-geral-e-autenticação)
2. [Dashboard](#2-dashboard)
3. [Obras](#3-obras)
4. [Estoque](#4-estoque)
5. [Funcionários](#5-funcionários)
6. [Financeiro](#6-financeiro)
7. [Manutenções](#7-manutenções)
8. [Clientes, Documentos, Notas, Relatórios, Administrativo, Configurações, Perfil](#8-outras-páginas)
9. [Admin e permissões](#9-admin-e-permissões)
10. [APIs internas](#10-apis-internas)
11. [Páginas públicas e impressão](#11-páginas-públicas-e-impressão)
12. [Camada de dados e schema](#12-camada-de-dados-e-schema)
13. [Componentes reutilizáveis](#13-componentes-reutilizáveis)
14. [Observações e pontos de atenção](#14-observações-e-pontos-de-atenção)

---

## 1. Visão geral e autenticação

- **Login** (`/login`): e-mail/senha via Supabase Auth. Fluxo de "esqueci a senha" (envio de link) e redefinição via link de recuperação.
- **Middleware** (`middleware.ts`): protege todas as rotas exceto assets estáticos, `/login`, `/auth` e `/pub/*`. Sem sessão → redireciona para `/login`. Com sessão, ao acessar `/login` → redireciona para `/dashboard`.
- **`/` (raiz)** redireciona para `/dashboard`.
- **Layout autenticado** (`app/(app)/layout.tsx`): menu lateral (`Sidebar`) + conteúdo + widget flutuante de notas (`NotasFlutuante`).
- **Perfis de acesso** (`app_profiles`): `role` = `admin` ou `usuario`; `permissions` (array) — hoje só existe a permissão `financeiro`; `active` (bloqueio de acesso).
- **Controle de acesso**: `lib/access.ts` (servidor) e `lib/useAccess.ts` (cliente, hook `useAccess()`), expõem `isAdmin` e `can(permissao)`. Admin sempre tem acesso total; usuário comum precisa estar `active` e ter a permissão explícita.
- Páginas restritas a admin: `/funcionarios`, `/financeiro`, `/administrativo`, `/admin/*` (usuários não-admin são redirecionados para `/obras`).
- A aba **Financeiro** de uma obra e o Centro de Custos só aparecem para quem tem a permissão `financeiro`.
- O e-mail `joaovictor@marvservicos.com.br` é o admin principal e é protegido contra rebaixamento/bloqueio (checagem em código + trigger SQL `protect_primary_admin`).

## 2. Dashboard

Tela inicial (`/dashboard`), somente leitura:
- **Cards de KPI**: Obras em andamento/aprovadas; "A faturar este mês" (soma de medições planejadas do mês, só admin); "Sem alocação hoje" (funcionários ativos sem registro no quadro de alocação, em dia útil); "Estoque crítico" (produtos abaixo do mínimo).
- **Obras ativas**: lista com barra de progresso de faturamento e prazo.
- **Medições pendentes** (só admin): medições vencendo em até 7 dias, com destaque para atrasadas.
- **Estoque crítico**: lista de produtos abaixo da quantidade mínima.

## 3. Obras

### Lista (`/obras`)
Cards de obra com busca e filtro por status (Em orçamento / Aprovada / Em andamento / Concluída). Botão **Nova Obra** (modal `ModalNovaObra`, também usado para editar via menu "⋮" no card).

### Detalhe da obra (`/obras/[id]`)
Tela central do sistema (arquivo com ~3900 linhas). Abas:

- **Visão Geral**: dados do projeto (tipo de serviço, engenheiro responsável, nº contrato, datas, endereço), campo de status inline (`Em Orçamento → Aprovada → Em Andamento → Concluída`), card de tempo decorrido/restante com alerta de prazo vencido, dados de Gestor/Comprador e Tomador da NF (empresa), ações rápidas.
- **Relatórios (RDO)**: lista de Relatórios Diários de Obra. Botão "Criar novo RDO" gera o registro com 2 períodos de clima padrão (manhã/tarde) e abre `/obras/[id]/rdo/[rdoId]`.
- **Materiais**: CRUD de materiais da obra — origem (compra interna/do cliente), fornecedor, comprador, datas de compra/chegada prevista/real, quantidade, valores unitário/total, preço de venda, nº OC, status (`pendente → orçado → comprado → em_trânsito → recebido → instalado`), anexo de nota fiscal.
  - **Importação de NF em PDF**: extração automática via parsing client-side (regex de DANFE) ou via API (`POST /api/parse-nfe`, usa IA Gemini) — sempre com tela de revisão antes de gravar.
- **Equipe** (só admin): aloca funcionários à obra, com dias trabalhados e custo diário/extra.
- **Documentos**: pastas hierárquicas (com subpastas), upload de arquivos para o Supabase Storage, exclusão remove também do storage.
- **Cronograma**: etapas com responsável, datas, % de progresso, status e cor; importação via Excel; exclusão individual ou em lote.
- **Financeiro** (link externo, `/obras/[id]/financeiro`): ver seção 6.
- Botão **Enviar Email** (admin): usa os Modelos de Email cadastrados em Configurações, resolve variáveis (`{{nome_obra}}`, `{{nome_gestor}}`, etc.) e envia via `POST /api/send-email`.

### Modelos de RDO (`/obras/[id]/modelos`)
CRUD de modelos de relatório: nome, até 3 logomarcas, seleção de quais seções aparecem (clima, mão de obra, equipamento, atividade, ocorrência, comentário, foto, assinatura), tipo de assinatura (manual/digital) e lista de signatários.

### Preenchimento do RDO (`/obras/[id]/rdo/[rdoId]`)
Edição em tempo real (cada alteração salva direto no banco):
- Status: `preenchendo → revisando → aprovado`.
- Clima (3 períodos: manhã/tarde/noite — tempo, condição, índice pluviométrico).
- Mão de obra (função, tipo, quantidade).
- Equipamentos (nome + quantidade).
- Atividades (descrição, % progresso, status).
- Ocorrências e comentários (texto livre).
- Fotos (upload múltiplo com legenda).
- Assinaturas.
- Botão de impressão → `/print/rdo/[rdoId]` ou `/obras/[id]/rdo/[rdoId]/imprimir`.

### `/obras/[id]/pagamentos`
Apenas redireciona para `/obras/[id]/financeiro`.

## 4. Estoque

> **Atenção**: o sistema tem **dois módulos de estoque paralelos**. O atual (v2), acessado por `/estoque`, é o usado no dia a dia. Há também um módulo mais antigo (`/estoque/itens` e `/estoque/movimentacao`) que ainda funciona mas não deve ser o fluxo principal — vale decidir se será descontinuado.

### Módulo atual — `/estoque`
- **Lista de estoques**: cada "estoque" é uma categoria (ex.: EPI, Limpeza, Uniformes) com ícone e cor próprios. Botão **Novo Estoque**.
- **Detalhe do estoque** (`/estoque/[estoqueId]`), abas:
  - **Registros**: entradas/saídas com filtros de tipo e data, seleção em lote, campos customizados por estoque, assinatura em imagem, botão **Devolução** (em saídas) que cria uma entrada de retorno e recalcula o custo médio ponderado (CMP).
  - **Produtos**: nome, código/nº CA, código de barras (com leitor via câmera), unidade, quantidade atual/mínima, preço unitário (CMP), foto; exclusão é soft-delete; alertas visuais de "Crítico" e "Negativo"; ajustes manuais de quantidade geram log de auditoria.
  - **Configurar**: campos customizados por estoque (texto/número/data/unidade, obrigatório ou não).
- **Importar CSV** (`/estoque/[estoqueId]/importar`): dois modos (Registros ou Produtos), detecção automática de separador, mapeamento de colunas, opção de cadastrar produtos automaticamente.
- **Novo Registro** (`/estoque/[estoqueId]/registrar`):
  - **Saída**: seleciona produto, valida saldo, campos customizados, responsável, assinatura; destino varia por tipo de estoque (EPI/Uniforme → funcionário; Limpeza → obra/funcionário/uso interno; outros → obra obrigatória).
  - **Entrada**: três fluxos — Lançar NF manual (multi-item), Importar NF em PDF (via IA), ou Novo Registro simples (item único).
  - Toda entrada recalcula o CMP: `(qtd_atual×cmp_atual + qtd_nova×preço_novo) / qtd_total`.

### Módulo legado — `/estoque/itens` e `/estoque/movimentacao`
- Grid de itens com foto, categoria, filtro, badges de nível (Zerado/Baixo).
- Ficha do item: histórico de movimentações, devoluções pendentes com botão "Devolvido".
- Formulário de entrada/saída com cálculo de CMP e opção "precisa ser devolvido" (com data prevista).
- `/estoque/movimentacoes`: tabela global (últimas 100) com filtro por tipo.

## 5. Funcionários

Restrito a admin. Redireciona não-admins para `/obras`.

### Lista (`/funcionarios`)
Tabela com cargo, custo total/mês, custo/dia, custo/hora, status. Cards de resumo (Ativos, Custo Mensal Real, Custo/Dia Médio, Provisão Rescisória). Botão "Quadro" → tela de alocação.

**Cadastro/edição** inclui:
- Dados base: salário bruto, dias/mês (30), horas/mês (220), data de admissão.
- Encargos trabalhistas (%, editáveis): FGTS (8%), INSS Patronal, 13º salário (8,33%), Férias+abono (11,11%), Provisão multa FGTS (3,2%).
- Benefícios: vale-refeição, vale-transporte (com desconto do funcionário, máx. 6% CLT), plano de saúde, outros customizados.
- Preview ao vivo do custo real calculado (mensal/dia/hora).
- Fórmula: `custo total mensal = salário + encargos% + benefícios`; `custo/dia = total ÷ dias_mês`; `custo/hora = total ÷ horas_mês`.
- Provisão rescisória: `FGTS acumulado = salário × FGTS% × meses de casa`; `multa = FGTS acumulado × 40%`.

### Ficha do funcionário (`/funcionarios/[id]`)
Breakdown detalhado de custo, histórico de itens de estoque recebidos (EPIs etc.), filtro por estoque de origem.

### Quadro de Alocação (`/funcionarios/alocacao`)
Grade tipo planilha — linhas = funcionários, colunas = dias (visão Mensal ou Semanal). Tipos de alocação: **Obra, Manutenção, Galpão, Folga, Atestado, Falta** (cada um com cor própria).
- Clique em uma célula abre modal de edição, permitindo dividir o dia entre múltiplos tipos (ex.: 50% obra A + 50% obra B), registrar transporte do dia (veículo da empresa/transporte público/direto), marcar turno noturno e observações.
- Preenchimento em massa: clique no cabeçalho de um dia aplica para todos; seleção múltipla de funcionários + clique em um dia também aplica em lote.
- Exportação de relatório mensal (impressão HTML) com totais por funcionário.

## 6. Financeiro

Existem três telas financeiras distintas:

1. **`/financeiro`** (geral, admin): relatório do valor total imobilizado em estoque (quantidade × preço unitário), agrupado por categoria de estoque. Somente leitura.
2. **`/obras/[id]/financeiro`** (DRE por obra):
   - Resumo: Contrato total, Faturado, Custo real (estoque + materiais + mão de obra pró-rata), Margem bruta % (verde ≥20%, âmbar 0–20%, vermelho negativo).
   - Aba **Medições**: plano de faturamento por etapas percentuais do contrato.
   - Aba **Centro de Custos**: detalhamento de custos da obra.
3. **`/admin`** (financeiro administrativo agregado — ver seção 9).

## 7. Manutenções

Módulo de contratos de manutenção preventiva (ar-condicionado).

### Lista (`/manutencoes`)
Cards de contratos com empresa, número, valor mensal, data de início, status. Estatísticas de contratos ativos e receita mensal.

### Detalhe do contrato (`/manutencoes/[id]`)
- **Financeiro**: mensalidade base, aditivos (descrição/valor/data), notas fiscais (competência, valor, número, status pendente/emitida, upload de arquivo).
- **Equipe**: funcionários alocados ao contrato (fixo ou eventual).
- **Equipamentos**: organizados em grupos (ex. "1º andar"). CRUD de equipamentos (tipo Split/Cassete/VRF/Janela/Piso-teto/Chiller/Fan Coil/Condensadora/Outro, marca, modelo, capacidade BTU, nº série, localização, data de instalação).

### Ficha do equipamento (`/manutencoes/[id]/equipamentos/[equipId]`)
- Botão para gerar **QR Code** que aponta para a ficha pública (`/pub/equipamento/[equipId]`) e link para a etiqueta imprimível (`/pub/etiqueta/[equipId]`).
- Campos técnicos dinâmicos (criados livremente pelo usuário e reaproveitados entre equipamentos).
- Histórico de manutenções por competência: preventiva realizada (checkbox), corretiva com descrição e custo adicional.

## 8. Outras páginas

- **`/clientes`**: abas Pessoas (nome, e-mail, telefone, tipo Gestor/Comprador, vínculo a empresa) e Empresas (razão social, CNPJ, endereço, contato). Excluir cliente desvincula obras; excluir empresa desvincula pessoas.
- **`/documentos`**: página informativa — os documentos reais ficam na aba "Documentos" de cada obra.
- **`/notas`**: bloco de notas pessoal do usuário (mesmo componente do widget flutuante presente em todo o app).
- **`/relatorios`**: três abas somente-leitura — Obras (tabela geral), Estoque Crítico, Registros Recentes de estoque. Botão de impressão.
- **`/administrativo`** (admin): custos administrativos não vinculados a obra, por categoria (ícone/cor customizáveis), com recorrência mensal/anual/única. KPIs de total mensal recorrente, projeção anual, avulsos do mês.
- **`/configuracoes`**: hub com Meu Perfil, Dados da Empresa, Tributação Simples Nacional (alíquota efetiva, usada no Centro de Custos), Adicionais de Mão de Obra (% customizáveis), Frota de Veículos (usados no Quadro de Alocação), Segurança (troca de senha, logout), Modelos de Email (usados no botão "Enviar Email" da obra), e informações sobre uso de leitor de código de barras.
- **`/perfil`**: resumo do usuário logado (nome, e-mail, cargo, nível de acesso).

## 9. Admin e permissões

Rotas sob `/admin/*` são protegidas — exigem `role = admin` e `active = true`, senão redirecionam para `/obras`.

- **`/admin`**: financeiro administrativo agregado — soma de todas as medições de todas as obras (Planejado/Faturado/Recebido/Em aberto), lista de obras com progresso de faturamento, etapas vencidas sem recebimento.
- **`/admin/usuarios`**: lista de todos os perfis (`app_profiles`). Por usuário: trocar perfil (usuário/admin), marcar permissão "Financeiro e medições", ativar/bloquear acesso. Criação de novo usuário (nome, e-mail, senha inicial ≥8 caracteres, perfil, permissão) via `POST /api/admin/users`.

## 10. APIs internas

| Rota | Método | Função |
|---|---|---|
| `/api/admin/users` | POST | Cria usuário (Supabase Admin API + `app_profiles`), só admin ativo pode chamar. Faz rollback se falhar. |
| `/api/parse-nfe` | POST | Recebe PDF de nota fiscal, envia para IA (Gemini) e retorna JSON estruturado (emitente, número, data, valor, produtos). Usado em Materiais da obra e Registro de estoque. |
| `/api/send-email` | POST | Envia e-mail via Resend, detecta HTML vs. texto puro. Usado no botão "Enviar Email" da obra. |

## 11. Páginas públicas e impressão

Acessíveis sem login (liberadas no middleware):

- **`/pub/equipamento/[equipId]`**: ficha técnica pública de um equipamento — foto, dados técnicos, histórico de manutenção (12 meses). Acessada via QR code.
- **`/pub/etiqueta/[equipId]`**: etiqueta imprimível 80×50mm com logo, tipo/nome do equipamento, modelo/nº série e QR code apontando para a ficha pública.
- **`/print/rdo/[rdoId]`**: layout de impressão do RDO, customizado conforme o modelo ativo da obra (logos e seções habilitadas).

## 12. Camada de dados e schema

- **Acesso ao banco**: quase todo o app lê/escreve diretamente no Supabase (`supabase.from(tabela).select/insert/update/delete`) a partir dos componentes de página — não há uma camada de API própria além das 3 rotas da seção 10.
- **Clientes Supabase**: `lib/supabase/client.ts` (browser) e `lib/supabase/server.ts` (server components/middleware/APIs, via cookies).
- **Autenticação**: Supabase Auth (e-mail/senha); perfis espelhados em `app_profiles` via trigger `handle_new_app_user`.

### Principais tabelas por módulo

- **Perfis/permissões**: `app_profiles`.
- **Financeiro**: `obra_medicoes`, `obra_financeiro`.
- **Estoque (atual)**: `estoques`, `estoque_campos`, `estoque_produtos`, `estoque_registros`, `estoque_registro_valores`, `estoque_logs`.
- **Estoque (legado)**: `estoque_categorias`, `estoque_itens`, `estoque_movimentacoes`, `estoque_alertas`.
- **Documentos**: `doc_pastas`, `documentos`.
- **RDO**: `rdos`, `rdo_clima`, `rdo_mao_obra`, `rdo_equipamentos`, `rdo_atividades`, `rdo_ocorrencias`, `rdo_comentarios`, `rdo_fotos`, `rdo_assinaturas`, `rdo_modelos`.
- **Manutenções**: `contratos_manutencao`, `manutencao_aditivos`, `manutencao_nfs`, `manutencao_funcionarios`, `equipamentos`, `grupos_equipamentos`, `campos_tecnicos`, `equipamento_dados`, `manutencao_historico`.
- **Funcionários**: `funcionarios`, `funcionario_alocacoes`, `veiculos`.
- **Obras/Clientes**: `obras`, `clientes`, `empresas`, `cronograma_etapas`, `obra_materiais`.
- **Administrativo**: `categorias_administrativas`, `custos_administrativos`, `configuracoes_empresa`, `email_templates`.

> Algumas tabelas acima (`obras`, `rdo_modelos`, `campos_tecnicos`, `equipamento_dados`, `grupos_equipamentos` etc.) não foram encontradas nos arquivos `.sql` versionados no repositório — provavelmente foram criadas via migrations do Supabase não incluídas aqui ou diretamente no Supabase Studio. Para o schema definitivo e completo, rode `list_tables`/`generate_typescript_types` direto no projeto Supabase.

## 13. Componentes reutilizáveis

| Componente | Uso |
|---|---|
| `BarcodeScannerModal` | Leitura de código de barras/QR via câmera (Estoque) |
| `GestaoPJPanel` | Gestão financeira de prestador PJ (ficha de funcionário) |
| `ModalNovaObra` | Criação/edição de obra |
| `NotasFlutuante` | Widget flutuante de notas, presente em todo o app |
| `NotasPanel` | Painel completo de notas |
| `ObraCentroCustos` | Aba Centro de Custos do financeiro da obra |
| `ObraPagamentos` | Aba Medições do financeiro da obra (plano de faturamento) |
| `RichTextEditor` | Editor de texto rico (Modelos de Email) |
| `Sidebar` | Menu lateral de navegação |
| `StatusChip` | Badge de status colorido |
| `Topbar` | Barra superior com busca/ações |

## 14. Observações e pontos de atenção

- **Dois módulos de estoque coexistindo** (`/estoque` vs. `/estoque/itens`+`/estoque/movimentacao`) — considerar unificar ou descontinuar o legado para evitar confusão dos usuários.
- **Caso hardcoded**: a ficha de funcionário mostra uma aba extra "Gestão PJ" apenas se o nome contiver "João Victor" — isso é uma regra fixa no código, não uma configuração, e deve ser generalizada se outros PJs precisarem do mesmo recurso.
- **Dados da Empresa em Configurações**: parece não persistir de forma clara (fica em estado local) — vale revisar.
- **Sistema de permissões é raso**: hoje só existe a permissão granular `financeiro`; tudo mais é admin-ou-não.
- **Ambiente de verificação**: este manual foi escrito por revisão estática do código — não foi possível rodar `npm run build`/dev server neste ambiente (Node/npm indisponíveis) para validação funcional real. Recomenda-se testar manualmente os fluxos críticos (RDO, estoque, financeiro) antes de considerar release.
