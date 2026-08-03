-- ============================================================
-- Segunda foto por item (ex.: evaporadora + condensadora de um
-- ar-condicionado cadastrado como patrimônio).
-- ============================================================

alter table ferramentas add column if not exists foto_url_2 text;
