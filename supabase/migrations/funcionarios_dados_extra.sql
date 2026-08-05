-- ============================================================
-- Dados adicionais do funcionário (CPF, telefone, e-mail, função) e
-- flag de quem está habilitado a assinar como responsável pela
-- entrega de itens de estoque (EPI, uniforme, ferramentas etc.).
-- ============================================================

alter table funcionarios add column if not exists cpf text;
alter table funcionarios add column if not exists telefone text;
alter table funcionarios add column if not exists email text;
alter table funcionarios add column if not exists funcao text;
alter table funcionarios add column if not exists responsavel_entrega boolean not null default false;
