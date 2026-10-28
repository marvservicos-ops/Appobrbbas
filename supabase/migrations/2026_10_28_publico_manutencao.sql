-- ============================================================
-- Fecha a leitura anon das tabelas de ferramentas (patrimônio).
-- A chave anon fica no JS do site; com "public_select" qualquer pessoa
-- baixava valor de aquisição, nº de série, empréstimos e defeitos.
--
-- As fichas públicas do QR (/pub/ferramenta, /pub/etiqueta-ferramenta,
-- /pub/equipamento, /pub/etiqueta) agora leem no servidor com o service
-- client, só as colunas exibidas — não dependem destas policies.
-- Nenhuma outra parte do app lê estas tabelas como anon (conferido por grep).
--
-- Idempotente. Rodar DEPOIS do deploy do código novo das páginas /pub.
-- ============================================================

drop policy if exists "public_select" on ferramentas;
drop policy if exists "public_select" on ferramenta_emprestimos;
drop policy if exists "public_select" on ferramenta_emprestimo_itens;
drop policy if exists "public_select" on ferramenta_defeitos;
drop policy if exists "public_select" on ferramenta_dados;
