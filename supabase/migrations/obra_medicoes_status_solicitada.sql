-- Adiciona o status "solicitada" (medição já pedida ao cliente para
-- liberação/faturamento, aguardando resposta) entre "planejada" e "faturada".
-- Necessário pra dar suporte à visão simplificada do Portal do Cliente
-- (Emitido / Solicitado / Restante).
alter table obra_medicoes drop constraint if exists obra_medicoes_status_check;
alter table obra_medicoes add constraint obra_medicoes_status_check
  check (status in ('planejada', 'solicitada', 'faturada', 'recebida', 'atrasada', 'cancelada'));
