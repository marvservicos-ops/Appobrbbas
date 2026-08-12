alter table public.funcionarios
  add column if not exists tamanho_camisa text,
  add column if not exists tamanho_calca text,
  add column if not exists tamanho_bota text;
