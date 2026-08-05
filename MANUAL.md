# Manual do Sistema — MARV Gestão

Sistema de gestão de obras, estoque, ferramentas, funcionários, manutenções e financeiro, construído em Next.js 14 (App Router) + Supabase.

> Este manual foi gerado a partir de uma revisão do código-fonte, última atualização em 2026-08-03. Ele documenta o que o sistema faz e como está estruturado — não substitui uma auditoria de segurança nem o schema definitivo do banco (algumas tabelas foram criadas fora dos arquivos `.sql` versionados no repositório; veja seção 14).

## Sumário
1. [Visão geral e autenticação](#1-visão-geral-e-autenticação)
2. [Dashboard](#2-dashboard)
3. [Obras](#3-obras)
4. [Estoque](#4-estoque)
5. [Ferramentas (patrimônio)](#5-ferramentas-patrimônio)
6. [Funcionários](#6-funcionários)
7. [Financeiro e OCs](#7-financeiro-e-ocs)
8. [Manutenções](#8-manutenções)
8.5. [ESG](#85-esg)
9. [Outras páginas](#9-outras-páginas)
10. [Admin e permissões](#10-admin-e-permissões)
11. [APIs internas](#11-apis-internas)
12. [Portal do Cliente](#12-portal-do-cliente)
13. [Páginas públicas e impressão](#13-páginas-públicas-e-impressão)
14. [Camada de dados e schema](#14-camada-de-dados-e-schema)
15. [Componentes reutilizáveis](#15-componentes-reutilizáveis)
16. [Observações e pontos de atenção](#16-observações-e-pontos-de-atenção)

---

## 1. Visão geral e autenticação

- **Login** (`/login`): e-mail/senha via Supabase Auth. Fluxo de "esqueci a senha" (envio de link) e redefinição via link de recuperação.
- **Middleware** (`middleware.ts`): protege todas as rotas exceto assets estáticos, `/login`, `/auth`, `/pub/*`, `/portal/*` e `/api/portal/*`. Sem sessão → redireciona para `/login`. Com sessão, ao acessar `/login` → redireciona para `/dashboard`.
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
Tela central do sistema (arquivo com ~4000 linhas). Abas:

- **Visão Geral**: dados do projeto (tipo de serviço, engenheiro responsável, nº contrato, datas, endereço), campo de status inline (`Em Orçamento → Aprovada → Em Andamento → Concluída`), card de tempo decorrido/restante com alerta de prazo vencido, dados de Gestor/Comprador e Tomador da NF (empresa), ações rápidas.
- **Relatórios (RDO)**: lista de Relatórios Diários de Obra. Botão "Criar novo RDO" gera o registro com 2 períodos de clima padrão (manhã/tarde) e abre `/obras/[id]/rdo/[rdoId]`.
- **Materiais**: CRUD de materiais da obra — origem (compra interna/do cliente), fornecedor, comprador, datas de compra/chegada prevista/real, quantidade, valores unitário/total, preço de venda, **Ordem de Compra (OC)** vinculada, status (`pendente → orçado → comprado → em_trânsito → recebido → instalado`), anexo de nota fiscal.
  - **Nº da OC**: em vez de digitar texto livre, o campo agora é um seletor (`SeletorOC`) — escolhe uma `obra_oc` já existente da obra ou cria uma nova ali mesmo (número, tipo serviço/material/outro, valor total). Isso é o que faz um material aparecer corretamente agrupado na OC certa dentro do Financeiro e no Portal do Cliente (ver seções 7 e 12).
  - **Importação de NF em PDF**: extração automática via parsing client-side (regex de DANFE) ou via API (`POST /api/parse-nfe`, usa IA Gemini) — sempre com tela de revisão antes de gravar.
- **Equipe** (só admin): aloca funcionários à obra, com dias trabalhados e custo diário/extra.
- **Documentos**: pastas hierárquicas (com subpastas), upload de arquivos para o Supabase Storage, exclusão remove também do storage.
- **Cronograma**: etapas com responsável, datas, % de progresso, status e cor; importação via Excel; exclusão individual ou em lote.
- **Financeiro** (link externo, `/obras/[id]/financeiro`): ver seção 7.
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
- **Lista de estoques**: cada "estoque" é uma categoria (ex.: EPI, Limpeza, Uniformes, Ferramentas) com ícone e cor próprios. Botão **Novo Estoque**.
- **Detalhe do estoque** (`/estoque/[estoqueId]`), abas:
  - **Registros**: entradas/saídas com filtros de tipo e data, seleção em lote, campos customizados por estoque, assinatura em imagem, botão **Devolução** (em saídas) que cria uma entrada de retorno e recalcula o custo médio ponderado (CMP).
  - **Produtos**: nome, código/nº CA, código de barras (com leitor via câmera), unidade, quantidade atual/mínima, preço unitário (CMP), foto; exclusão é soft-delete; alertas visuais de "Crítico" e "Negativo"; ajustes manuais de quantidade geram log de auditoria.
  - **Configurar**: campos customizados por estoque (texto/número/data/unidade, obrigatório ou não).
- **Importar CSV** (`/estoque/[estoqueId]/importar`): dois modos (Registros ou Produtos), detecção automática de separador, mapeamento de colunas, opção de cadastrar produtos automaticamente.
- **Novo Registro** (`/estoque/[estoqueId]/registrar`):
  - **Saída**: seleciona produto, valida saldo, campos customizados, responsável, assinatura; destino varia por tipo de estoque (EPI/Uniforme → funcionário; Limpeza → obra/manutenção/uso interno; outros → obra obrigatória). Em Limpeza, destino "Manutenção" exige produto real do catálogo (não aceita "outro/texto livre") e escolhe um contrato de manutenção — repõe automaticamente o estoque local desse contrato (ver [Manutenções](#8-manutenções)).
  - **Entrada**: três fluxos — Lançar NF manual (multi-item), Importar NF em PDF (via IA), ou Novo Registro simples (item único).
  - Toda entrada recalcula o CMP: `(qtd_atual×cmp_atual + qtd_nova×preço_novo) / qtd_total`.
- **Categoria "Ferramentas"**: um estoque com ícone `wrench` tem comportamento completamente diferente das demais categorias — ver seção 5.

### Módulo legado — `/estoque/itens` e `/estoque/movimentacao`
- Grid de itens com foto, categoria, filtro, badges de nível (Zerado/Baixo).
- Ficha do item: histórico de movimentações, devoluções pendentes com botão "Devolvido".
- Formulário de entrada/saída com cálculo de CMP e opção "precisa ser devolvido" (com data prevista).
- `/estoque/movimentacoes`: tabela global (últimas 100) com filtro por tipo.

## 5. Ferramentas (patrimônio)

Vive **dentro de Estoque** como uma categoria especial: quando um estoque tem o ícone "chave inglesa" (`wrench`) **ou** "prédio" (`building2` — usado para patrimônio fixo do galpão: ar-condicionado, bebedouro, cafeteira etc.), a tela deixa de mostrar Registros/Produtos e passa a mostrar o painel de Ferramentas (`FerramentasPanel`). Diferente do estoque normal (quantidade fungível), aqui cada item é um **ativo individual rastreável** — ferramenta, máquina ou equipamento fixo, com identidade própria, QR code, histórico de custódia e defeitos. Para ativos fixos que nunca saem do lugar (ex. ar-condicionado do galpão), o fluxo de empréstimo simplesmente não é usado — o item fica sempre "Disponível".

### Cadastro
- Cada ferramenta tem: nome, **código interno/patrimônio** (obrigatório e único por categoria, ex. `FER-0001`, sugerido automaticamente ao cadastrar), categoria, marca/modelo, nº de série, valor de aquisição, data de aquisição, foto, observações.
- Card de **patrimônio total** (soma do valor de aquisição das ferramentas ativas) e contagem por status: Disponível / Emprestada / Em manutenção / Baixada.

### Empréstimo (custódia formal, com contrato)
- Botão **Novo Empréstimo**: seleciona um funcionário responsável (obrigatório) + uma ou mais ferramentas disponíveis. Ao salvar, gera um **contrato de empréstimo** (impresso em papel, assinatura física — sem captura digital) que abre automaticamente em nova aba para impressão.
- Devolução é **por item**: cada ferramenta do empréstimo pode voltar em uma data diferente das outras, sem precisar fechar o empréstimo inteiro.
- Botão **Ver Empréstimos**: lista todos os contratos gerados (abertos/devolvidos), com link para reimprimir o contrato a qualquer momento.

### Malas de ferramentas (custódia fixa, sem contrato)
Para ferramentas que ficam permanentemente com um encarregado dentro de uma mala/kit (não passam pelo fluxo de empréstimo formal):
- Uma ferramenta pode ser marcada como **"É uma mala"** (`eh_mala`), com um **responsável atual** atribuído diretamente (sem contrato, sem histórico de quem teve antes — só o responsável atual importa).
- Outras ferramentas podem ser marcadas como **pertencentes a uma mala** (`mala_id`) — elas somem do grid principal e da lista de empréstimo (não são emprestadas individualmente, seguem a mala), mas continuam com status próprio (podem entrar em manutenção ou ser baixadas independentemente).
- Na ficha da mala, o item mostra "Com {responsável} (na mala)" em vez de "Disponível", já que tecnicamente está com alguém.
- Botão **Imprimir contrato** na ficha da mala: gera um "Termo de Responsabilidade" com o responsável atual e a lista completa de itens da mala — disparado automaticamente ao atribuir/trocar responsável; para reimpressão após adicionar itens, é manual (para não forçar reimpressão a cada item adicionado).

### Defeito e manutenção
- **Registrar defeito**: só disponível quando a ferramenta não está emprestada nem já em manutenção (força devolução antes). Move o status para "Em manutenção".
- **Concluir manutenção**: marca o defeito como resolvido e volta o status para "Disponível".
- **Dar baixa**: definitiva (perda/quebra irrecuperável), bloqueada enquanto a ferramenta estiver emprestada. Sem reversão nesta versão.

### Dados técnicos (campos livres)
- Na ficha de cada ferramenta/ativo (exceto malas), é possível adicionar **campos técnicos livres** (nome + unidade opcional, ex. "Capacidade BTU", "Voltagem") e preencher um valor por item — mesma biblioteca de campos (`campos_tecnicos`) compartilhada com os equipamentos de Manutenções, então um campo criado em um módulo fica disponível para reutilizar no outro.
- Os valores ficam visíveis também na ficha pública (QR code).

### QR Code e ficha pública
- Cada ferramenta tem um botão de QR Code, apontando para `/pub/ferramenta/[id]` (ficha somente leitura) e um link de etiqueta imprimível 80×50mm (`/pub/etiqueta-ferramenta/[id]`).
- A ficha pública mostra status/custódia (inclusive "faz parte da mala X, com Y"), histórico de defeitos, e um botão **"Entrar para gerenciar"** que leva ao `/login` — nenhuma ação de escrita acontece na página pública.

### Na ficha do funcionário
A página `/funcionarios/[id]` tem uma seção **"Ferramentas"** listando todo o histórico de empréstimos daquele funcionário (nome, código, data de retirada/devolução, status "Em posse"/"Devolvida"), no mesmo padrão do histórico de recebimentos de estoque (EPIs).

## 6. Funcionários

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
Breakdown detalhado de custo, histórico de itens de estoque recebidos (EPIs etc.), filtro por estoque de origem, e histórico de ferramentas emprestadas (ver seção 5).

### Quadro de Alocação (`/funcionarios/alocacao`)
Grade tipo planilha — linhas = funcionários, colunas = dias (visão Mensal ou Semanal). Tipos de alocação: **Obra, Manutenção, Galpão, Folga, Atestado, Falta** (cada um com cor própria).
- Clique em uma célula abre modal de edição, permitindo dividir o dia entre múltiplos tipos (ex.: 50% obra A + 50% obra B), registrar transporte do dia (veículo da empresa/transporte público/direto), marcar turno noturno e observações.
- Preenchimento em massa: clique no cabeçalho de um dia aplica para todos; seleção múltipla de funcionários + clique em um dia também aplica em lote.
- Exportação de relatório mensal (impressão HTML) com totais por funcionário.

## 7. Financeiro e OCs

Existem três telas financeiras distintas:

1. **`/financeiro`** (geral, admin): relatório do valor total imobilizado em estoque (quantidade × preço unitário), agrupado por categoria de estoque. Somente leitura.
2. **`/obras/[id]/financeiro`** (DRE por obra), componente `ObraPagamentos`:
   - **Cards de resumo** (topo da página, logo abaixo do cabeçalho): Contrato, Faturado, Recebido, Saldo a faturar.
   - **Ordens de Compra (OCs)**: seção principal de medições hoje. Uma obra pode ter **várias OCs** (de serviço, material ou outro tipo), cada uma com seu próprio valor total e sua própria sequência independente de medições — reflete a realidade de que o cliente pode emitir OCs separadas para serviço e para material, ou juntar tudo numa só. Botão **Nova OC** (número, tipo, valor total). Dentro de cada OC: badge de tipo calculado a partir do conteúdo real (mostra "Serviço"/"Material", ou os dois, conforme as medições ali dentro — não fica preso ao tipo escolhido na criação), medições com o card completo de sempre (situação, datas de emissão/vencimento/pagamento, valor faturado/recebido, anexo de NF, editar/excluir), botão "Adicionar medição a esta OC", faturado e saldo calculados automaticamente por OC. Cada card de medição vem **fechado por padrão** (mostra só etapa/status/nome/valor) — clique para expandir os campos completos, deixando a tela mais organizada quando há várias medições.
   - **Configurações legadas (opcional)**: seção **minimizada por padrão** (clique para abrir) que reúne o **Valor base do contrato** (campo antigo de valor único por obra) e os **Aditivos de Contrato** (conceito de alteração de escopo/valor separado das OCs) — mantidos só para casos futuros de obra sem OC do cliente. A tela já avisa que um aditivo também pode ser cadastrado como uma OC (usando o nome pra descrever do que se trata), que é o caminho recomendado daqui pra frente.
   - **Nota Fiscal de Material**: gera uma medição a partir de materiais lançados na aba Materiais da obra (agrupados pela OC vinculada a cada material — ver seção 3). O sistema bloqueia gerar uma NF de material misturando itens de OCs diferentes.
   - **"Etapas da medição"** (legado): só aparece se a obra tiver medições-base antigas (de antes das OCs) ou ainda não tiver nenhuma OC cadastrada — em obras que já usam OCs normalmente, essa seção fica oculta para não mostrar um bloco vazio/confuso.
   - Botão **Gerar acesso do cliente**: cria/renova o acesso do Portal do Cliente para esta obra — ver seção 12.
   - Aba **Centro de Custos**: detalhamento de custos da obra (componente `ObraCentroCustos`).
3. **`/admin`** (financeiro administrativo agregado — ver seção 10).

## 8. Manutenções

Módulo de contratos de manutenção preventiva (ar-condicionado).

### Lista (`/manutencoes`)
Cards de contratos com empresa, número, valor mensal, data de início, status. Estatísticas de contratos ativos e receita mensal.

### Detalhe do contrato (`/manutencoes/[id]`)
- **Financeiro**: mensalidade base, aditivos (descrição/valor/data), notas fiscais (competência, valor, número, status pendente/emitida, upload de arquivo).
- **Equipe**: funcionários alocados ao contrato (fixo ou eventual).
- **Equipamentos**: organizados em grupos (ex. "1º andar"). CRUD de equipamentos (tipo Split/Cassete/VRF/Janela/Piso-teto/Chiller/Fan Coil/Condensadora/Outro, marca, modelo, capacidade BTU, nº série, localização, data de instalação).
- **Estoque**: mini-estoque local do cliente, reaproveitando o catálogo de produtos do Estoque central. "+ Adicionar produto" escolhe quais produtos esse contrato rastreia (com quantidade mínima); "+ Nova movimentação" lança entrada/saída direto no local (consumo dos funcionários em campo, ou compra emergencial). Produtos abaixo da quantidade mínima ficam com badge "Crítico" (ou "Negativo" se abaixo de zero), com contador na aba e banner de aviso. Quando uma saída de material de Limpeza no estoque central escolhe "Manutenção" como destino, o item entra automaticamente nesse estoque local do contrato (repondo o que foi levado).

### Ficha do equipamento (`/manutencoes/[id]/equipamentos/[equipId]`)
- Botão para gerar **QR Code** que aponta para a ficha pública (`/pub/equipamento/[equipId]`) e link para a etiqueta imprimível (`/pub/etiqueta/[equipId]`).
- Campos técnicos dinâmicos (criados livremente pelo usuário e reaproveitados entre equipamentos).
- Histórico de manutenções por competência: preventiva realizada (checkbox), corretiva com descrição e custo adicional.

## 8.5. ESG

Página `/esg`, com 4 abas, cada uma um log simples de dados (adicionar/editar/excluir) — substitui o controle que era feito em planilha:
- **Combustível**: abastecimentos vinculados aos veículos cadastrados (`veiculos`), com combustível/litros/valor/data. Totais de litros e valor gasto no topo.
- **Investimentos (Melhorias)**: item + categoria (Ambiental, Social, Ferramental, SST) + quantidade + valor. Totais por categoria.
- **Destinação dos Materiais**: material reciclável (ferro, cobre, alumínio etc.) enviado a um cliente/destino, com quantidade (kg) e valor recebido (opcional).
- **Reciclagem de Gás**: gás refrigerante recolhido (tipo, quantidade, valor recebido), com empresa emissora — pode ser vinculado a um contrato de manutenção existente (autopreenche a empresa a partir do contrato) ou lançado avulso para clientes fora do módulo de Manutenções.

Tabelas: `esg_combustivel`, `esg_investimentos`, `esg_destinacao_materiais`, `esg_reciclagem_gas`.

### Adicionar com IA
Botão no topo da página ESG (`ModalImportarEsgIA`): envia uma foto ou PDF de nota/cupom/romaneio para a rota `/api/parse-esg` (Gemini, mesma IA já usada em "Importar NF" no Estoque), que identifica automaticamente a categoria (combustível, investimento, destinação de materiais ou reciclagem de gás) e extrai os campos correspondentes (data, litros/kg/valor, tipo, veículo/cliente/gás etc.). O usuário confere e edita os campos pré-preenchidos antes de salvar — nada é inserido sem confirmação. Se a IA não conseguir classificar o documento, o usuário escolhe a categoria manualmente e preenche o formulário do zero. Requer a env var `GEMINI_API_KEY` (já configurada, mesma usada pelo import de NF).

## 9. Outras páginas

- **`/clientes`**: abas Pessoas (nome, e-mail, telefone, tipo Gestor/Comprador, vínculo a empresa) e Empresas (razão social, CNPJ, endereço, contato). Excluir cliente desvincula obras; excluir empresa desvincula pessoas.
- **`/documentos`**: página informativa — os documentos reais ficam na aba "Documentos" de cada obra.
- **`/notas`**: bloco de notas pessoal do usuário (mesmo componente do widget flutuante presente em todo o app).
- **`/relatorios`**: três abas somente-leitura — Obras (tabela geral), Estoque Crítico, Registros Recentes de estoque. Botão de impressão.
- **`/administrativo`** (admin): custos administrativos não vinculados a obra, por categoria (ícone/cor customizáveis), com recorrência mensal/anual/única. KPIs de total mensal recorrente, projeção anual, avulsos do mês.
- **`/configuracoes`**: hub com Meu Perfil, Dados da Empresa, Tributação Simples Nacional (alíquota efetiva, usada no Centro de Custos), Adicionais de Mão de Obra (% customizáveis), Frota de Veículos (usados no Quadro de Alocação), Segurança (troca de senha, logout), Modelos de Email (usados no botão "Enviar Email" da obra), e informações sobre uso de leitor de código de barras.
- **`/perfil`**: resumo do usuário logado (nome, e-mail, cargo, nível de acesso).

## 10. Admin e permissões

Rotas sob `/admin/*` são protegidas — exigem `role = admin` e `active = true`, senão redirecionam para `/obras`.

- **`/admin`**: financeiro administrativo agregado — soma de todas as medições de todas as obras (Planejado/Faturado/Recebido/Em aberto), lista de obras com progresso de faturamento, etapas vencidas sem recebimento.
- **`/admin/usuarios`**: lista de todos os perfis (`app_profiles`). Por usuário: trocar perfil (usuário/admin), marcar permissão "Financeiro e medições", ativar/bloquear acesso. Criação de novo usuário (nome, e-mail, senha inicial ≥8 caracteres, perfil, permissão) via `POST /api/admin/users`.
- **`/admin/manual`**: este manual, renderizado dentro do app a partir do `MANUAL.md` do repositório.

## 11. APIs internas

| Rota | Método | Função |
|---|---|---|
| `/api/admin/users` | POST | Cria usuário (Supabase Admin API + `app_profiles`), só admin ativo pode chamar. Faz rollback se falhar. |
| `/api/parse-nfe` | POST | Recebe PDF de nota fiscal, envia para IA (Gemini) e retorna JSON estruturado (emitente, número, data, valor, produtos). Usado em Materiais da obra e Registro de estoque. |
| `/api/send-email` | POST | Envia e-mail via Resend, detecta HTML vs. texto puro. Usado no botão "Enviar Email" da obra e no envio de acesso do Portal do Cliente. |
| `/api/portal/gerar-acesso` | POST | Autenticado (exige permissão `financeiro`). Gera token + PIN de 6 dígitos para o Portal do Cliente de uma obra, desativa o acesso anterior, hasheia o PIN (bcrypt) antes de salvar. |
| `/api/portal/[token]/verify` | POST | Público. Recebe o PIN digitado, compara com o hash salvo, cria uma sessão e devolve um cookie `httpOnly` válido por 30 dias. |

## 12. Portal do Cliente

Página externa (`/portal/[token]`) onde o cliente acompanha as OCs e medições de uma obra em tempo real, substituindo o processo manual de montar e enviar tabelas por e-mail.

- **Acesso**: link com um token longo e imprevisível na URL + um PIN de 6 dígitos que o cliente digita uma vez (fica lembrado no navegador por 30 dias via cookie). O link é **permanente por obra** — gerar um novo acesso (botão "Gerar acesso do cliente" na aba Financeiro da obra) invalida o anterior automaticamente.
- **Geração do acesso**: dentro do Financeiro da obra, botão "Gerar acesso do cliente" — se já existe um acesso ativo, mostra o link atual (o token fica salvo, só o PIN não); botão "Gerar novo acesso" cria um PIN novo (invalidando o anterior) e envia por e-mail direto para o gestor/comprador da obra. **O PIN não fica salvo em texto — só o hash. Se perdido, só gerando um novo.**
- **Conteúdo (somente leitura na v1)**: para cada OC ativa da obra, mostra número, tipo, valor total, e as medições agrupadas em **3 blocos simplificados** para o cliente — **Emitido** (NF já faturada/recebida, com número e data), **Solicitado** (medição pedida ao cliente, aguardando liberação — status interno `solicitada`) e **A faturar** (o restante) — cada bloco com seu subtotal, e o **saldo da OC em destaque** ao final. Os status internos completos (planejada/solicitada/faturada/recebida/atrasada/cancelada) continuam existindo para controle da MARV; o portal só resume isso pro que interessa ao cliente.
- **Segurança**: o portal nunca lê dados via RLS/chave anônima. Todas as consultas passam por rotas de API que usam um client Supabase **service-role** (`lib/supabase/service.ts`), com a validação de token+PIN acontecendo antes de qualquer leitura. Nenhuma tabela do portal (`obra_ocs`, `obra_acessos_cliente`, `obra_portal_sessoes`) tem política de acesso público (`anon`).
- **Fora de escopo nesta versão**: o cliente não aprova nada diretamente na página — isso continua acontecendo por e-mail/WhatsApp como hoje.

## 13. Páginas públicas e impressão

Acessíveis sem login (liberadas no middleware):

- **`/pub/equipamento/[equipId]`**: ficha técnica pública de um equipamento de manutenção — foto, dados técnicos, histórico de manutenção (12 meses). Acessada via QR code.
- **`/pub/etiqueta/[equipId]`**: etiqueta imprimível 80×50mm com logo, tipo/nome do equipamento, modelo/nº série e QR code apontando para a ficha pública.
- **`/pub/ferramenta/[id]`**: ficha pública de uma ferramenta/mala (ver seção 5) — status/custódia, histórico de defeitos, botão "Entrar para gerenciar".
- **`/pub/etiqueta-ferramenta/[id]`**: etiqueta imprimível 80×50mm de uma ferramenta, com QR apontando para a ficha acima.
- **`/print/rdo/[rdoId]`**: layout de impressão do RDO, customizado conforme o modelo ativo da obra (logos e seções habilitadas).
- **`/print/emprestimo/[emprestimoId]`**: contrato de empréstimo de ferramentas, pronto para impressão e assinatura física.
- **`/print/mala/[malaId]`**: termo de responsabilidade de uma mala de ferramentas (responsável atual + conteúdo completo), sempre reflete o estado atual (não guarda versões antigas).
- **`/portal/[token]`**: Portal do Cliente — ver seção 12 (protegido por PIN, mas fora do fluxo de login normal).

## 14. Camada de dados e schema

- **Acesso ao banco**: quase todo o app lê/escreve diretamente no Supabase (`supabase.from(tabela).select/insert/update/delete`) a partir dos componentes de página — a camada de API própria (seção 11) é usada só onde é preciso lógica privilegiada (criação de usuário, envio de e-mail, geração/validação de acesso do portal).
- **Clientes Supabase**:
  - `lib/supabase/client.ts` (browser, chave anônima).
  - `lib/supabase/server.ts` (server components/middleware/APIs autenticadas, via cookies, chave anônima).
  - `lib/supabase/service.ts` (**service-role**, ignora RLS — uso exclusivo dentro das rotas de API do Portal do Cliente, nunca importado em código de cliente).
- **Autenticação**: Supabase Auth (e-mail/senha); perfis espelhados em `app_profiles` via trigger `handle_new_app_user`.

### Principais tabelas por módulo

- **Perfis/permissões**: `app_profiles`.
- **Financeiro**: `obra_medicoes` (ganhou `oc_id`, além do `aditivo_id` já existente), `obra_financeiro` (legado), `obra_aditivos`, `obra_ocs` (novo).
- **Portal do Cliente**: `obra_acessos_cliente` (token + PIN hasheado), `obra_portal_sessoes` (sessão pós-PIN).
- **Estoque (atual)**: `estoques`, `estoque_campos`, `estoque_produtos`, `estoque_registros`, `estoque_registro_valores`, `estoque_logs`.
- **Estoque (legado)**: `estoque_categorias`, `estoque_itens`, `estoque_movimentacoes`, `estoque_alertas`.
- **Ferramentas**: `ferramentas` (`eh_mala`, `mala_id`, `responsavel_atual_id`, `codigo_interno`), `ferramenta_emprestimos`, `ferramenta_emprestimo_itens`, `ferramenta_defeitos`, `ferramenta_dados` (campos técnicos livres, referencia `campos_tecnicos` — mesma tabela usada pelos equipamentos de Manutenções).
- **Documentos**: `doc_pastas`, `documentos`.
- **RDO**: `rdos`, `rdo_clima`, `rdo_mao_obra`, `rdo_equipamentos`, `rdo_atividades`, `rdo_ocorrencias`, `rdo_comentarios`, `rdo_fotos`, `rdo_assinaturas`, `rdo_modelos`.
- **Manutenções**: `contratos_manutencao`, `manutencao_aditivos`, `manutencao_nfs`, `manutencao_funcionarios`, `equipamentos`, `grupos_equipamentos`, `campos_tecnicos`, `equipamento_dados`, `manutencao_historico`, `manutencao_estoque_produtos`, `manutencao_estoque_registros` (mini-estoque local por contrato; `estoque_registros` ganhou `manutencao_id`).
- **Funcionários**: `funcionarios`, `funcionario_alocacoes`, `veiculos`.
- **Obras/Clientes**: `obras`, `clientes`, `empresas`, `cronograma_etapas`, `obra_materiais` (ganhou `oc_id`), `obra_notas_material` (ganhou `oc_id`).
- **Administrativo**: `categorias_administrativas`, `custos_administrativos`, `configuracoes_empresa`, `email_templates`.
- **ESG**: `esg_combustivel` (liga a `veiculos`), `esg_investimentos`, `esg_destinacao_materiais`, `esg_reciclagem_gas` (liga opcionalmente a `contratos_manutencao`).

> Algumas tabelas acima (`obras`, `rdo_modelos`, `campos_tecnicos`, `equipamento_dados`, `grupos_equipamentos`, `obra_materiais`, `obra_notas_material` etc.) não têm migração rastreada no repositório — foram criadas via Supabase Studio ou migrations não versionadas. As tabelas novas descritas neste manual (`ferramentas*`, `obra_ocs`, `obra_acessos_cliente`, `obra_portal_sessoes`, e as colunas `oc_id` adicionadas) **estão** rastreadas em `supabase/migrations/*.sql`. Para o schema definitivo e completo, rode `list_tables`/`generate_typescript_types` direto no projeto Supabase.

## 15. Componentes reutilizáveis

| Componente | Uso |
|---|---|
| `BarcodeScannerModal` | Leitura de código de barras/QR via câmera (Estoque) |
| `GestaoPJPanel` | Gestão financeira de prestador PJ (ficha de funcionário) |
| `ModalNovaObra` | Criação/edição de obra |
| `NotasFlutuante` | Widget flutuante de notas, presente em todo o app |
| `NotasPanel` | Painel completo de notas |
| `ObraCentroCustos` | Aba Centro de Custos do financeiro da obra |
| `ObraPagamentos` | Aba Medições/OCs do financeiro da obra (plano de faturamento, aditivos, NF de material, acesso do portal) |
| `RichTextEditor` | Editor de texto rico (Modelos de Email) |
| `Sidebar` | Menu lateral de navegação |
| `StatusChip` | Badge de status colorido |
| `Topbar` | Barra superior com busca/ações |

Componentes locais (não exportados, vivem dentro de arquivos maiores): `FerramentasPanel`, `FerramentaDetalheModal`, `ModalNovaFerramenta`, `ModalEditarFerramenta`, `ModalNovoEmprestimo`, `ModalDevolverItem`, `ModalDefeito`, `ModalAtribuirMala`, `ModalEmprestimos` (todos em `app/(app)/estoque/[estoqueId]/ferramentas/`); `SeletorOC` (dentro de `app/(app)/obras/[id]/page.tsx`); `ModalOC`, `ModalAcessoCliente` (dentro de `components/ObraPagamentos.tsx`).

## 16. Observações e pontos de atenção

- **Dois módulos de estoque coexistindo** (`/estoque` vs. `/estoque/itens`+`/estoque/movimentacao`) — considerar unificar ou descontinuar o legado para evitar confusão dos usuários.
- **Caso hardcoded**: a ficha de funcionário mostra uma aba extra "Gestão PJ" apenas se o nome contiver "João Victor" — isso é uma regra fixa no código, não uma configuração, e deve ser generalizada se outros PJs precisarem do mesmo recurso.
- **Dados da Empresa em Configurações**: parece não persistir de forma clara (fica em estado local) — vale revisar.
- **Sistema de permissões é raso**: hoje só existe a permissão granular `financeiro`; tudo mais é admin-ou-não.
- **Duas noções de "valor base" convivendo no Financeiro da obra**: o campo legado `obra_financeiro.valor_contrato` (um valor único por obra) e as novas OCs (múltiplos valores, um por OC). Obras antigas foram migradas automaticamente para uma "OC padrão" na hora da migração, mas o campo antigo continua editável na tela — pode gerar confusão se alguém usar os dois ao mesmo tempo sem entender a relação.
- **PIN do Portal do Cliente não é recuperável**: se o cliente perder o PIN e você não guardou uma cópia, a única saída é gerar um novo acesso (o que invalida o link anterior).
- **Ambiente de verificação**: este manual foi escrito por revisão estática do código — não foi possível rodar `npm run build`/dev server neste ambiente (Node/npm indisponíveis) para validação funcional real. Recomenda-se testar manualmente os fluxos críticos (RDO, estoque, ferramentas, financeiro, portal do cliente) antes de considerar release.
