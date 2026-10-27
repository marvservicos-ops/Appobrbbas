-- Motivo da folga, falta ou atestado na alocação de funcionários
-- (ex.: folga "Feriado", falta "Problema pessoal", atestado "Consulta médica")
alter table public.funcionario_alocacoes add column if not exists motivo text;
