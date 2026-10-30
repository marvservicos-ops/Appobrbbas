-- ============================================================
-- Documentos dos funcionários: modelos com campos automáticos
-- ({{funcionario.nome}}, {{empresa.cnpj}}...), emissões e a pasta
-- de documentos emitidos de cada funcionário.
-- RODAR MANUALMENTE no SQL Editor do Supabase. Idempotente.
-- ============================================================

-- ── 1. Modelos (cada versão é uma linha; grupo_id junta as versões) ──
create table if not exists public.doc_modelos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null,
  nome text not null,
  versao text not null,
  vigencia date,
  exige_assinatura boolean not null default true,
  -- coletivo: sai um documento só, com lista de recebimento dos funcionários
  coletivo boolean not null default false,
  conteudo_html text not null default '',
  -- campos que não vêm do cadastro: [{chave, rotulo, padrao}] → {{campo.<chave>}}
  campos_extras jsonb not null default '[]'::jsonb,
  arquivo_origem text,
  atual boolean not null default true,
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  criado_por_nome text,
  created_at timestamptz not null default now()
);
create index if not exists doc_modelos_grupo_idx on public.doc_modelos (grupo_id);
create unique index if not exists doc_modelos_um_atual_idx on public.doc_modelos (grupo_id) where atual;

-- ── 2. Emissões (uma por geração) ──
create table if not exists public.doc_emissoes (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references public.doc_modelos(id),
  data_emissao date not null,
  valores_extras jsonb not null default '{}'::jsonb,
  emitido_por uuid default auth.uid(),
  emitido_por_nome text,
  created_at timestamptz not null default now()
);

-- ── 3. Documentos emitidos (um por funcionário — a "pasta" dele) ──
create table if not exists public.doc_emitidos (
  id uuid primary key default gen_random_uuid(),
  emissao_id uuid not null references public.doc_emissoes(id) on delete cascade,
  modelo_id uuid not null references public.doc_modelos(id),
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  -- texto já preenchido no momento da emissão (reimprime igual)
  conteudo_html text not null,
  status text not null default 'pendente' check (status in ('pendente', 'assinado', 'entregue')),
  arquivo_assinado_path text,
  assinado_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists doc_emitidos_func_idx on public.doc_emitidos (funcionario_id);
create index if not exists doc_emitidos_emissao_idx on public.doc_emitidos (emissao_id);
create index if not exists doc_emitidos_modelo_idx on public.doc_emitidos (modelo_id);

-- ── 4. Acesso: só admin (os documentos têm CPF) ──
alter table public.doc_modelos enable row level security;
alter table public.doc_emissoes enable row level security;
alter table public.doc_emitidos enable row level security;

drop policy if exists "admin_all" on public.doc_modelos;
create policy "admin_all" on public.doc_modelos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin_all" on public.doc_emissoes;
create policy "admin_all" on public.doc_emissoes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin_all" on public.doc_emitidos;
create policy "admin_all" on public.doc_emitidos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Vias assinadas (foto/PDF): bucket privado, só admin
insert into storage.buckets (id, name, public)
values ('funcionarios-docs', 'funcionarios-docs', false)
on conflict (id) do update set public = false;

drop policy if exists "admin_all_funcionarios_docs" on storage.objects;
create policy "admin_all_funcionarios_docs" on storage.objects
  for all to authenticated
  using (bucket_id = 'funcionarios-docs' and public.is_admin())
  with check (bucket_id = 'funcionarios-docs' and public.is_admin());

-- ── 5. Dados da empresa: endereço da matriz e responsável ──
-- Muda também o endereço que sai nos termos de EPI.
update public.configuracoes_empresa
   set valor = coalesce(valor, '{}'::jsonb) || jsonb_build_object(
     'endereco', 'Estrada do Rio Grande, 268 – Taquara, Rio de Janeiro/RJ',
     'responsavel_nome', coalesce(nullif(valor->>'responsavel_nome', ''), 'Marcelo Lopes Leal'),
     'responsavel_cargo', coalesce(nullif(valor->>'responsavel_cargo', ''), 'Sócio-Proprietário'))
 where chave = 'dados_empresa';

insert into public.configuracoes_empresa (chave, descricao, valor)
select 'dados_empresa', 'Dados da empresa', jsonb_build_object(
  'razao_social', 'MARV MANUTENÇÃO E SERVIÇOS LTDA EPP',
  'cnpj', '03.709.796/0001-44',
  'endereco', 'Estrada do Rio Grande, 268 – Taquara, Rio de Janeiro/RJ',
  'responsavel_nome', 'Marcelo Lopes Leal',
  'responsavel_cargo', 'Sócio-Proprietário')
where not exists (select 1 from public.configuracoes_empresa where chave = 'dados_empresa');

-- ── 6. Primeiros modelos (ponto eletrônico — Sólides) ──
insert into public.doc_modelos (grupo_id, nome, versao, vigencia, exige_assinatura, coletivo, conteudo_html, campos_extras, criado_por_nome)
select '7d0c1a10-0001-4000-8000-000000000001', 'Política de Controle de Jornada', '1.0', '2026-11-03', false, false,
$html$<h1>Política de Controle de Jornada</h1><p><strong>{{empresa.nome}}</strong> – CNPJ {{empresa.cnpj}}</p><p><strong>Versão {{modelo.versao}} – vigente a partir de {{modelo.vigencia}}</strong></p><h2>1. Objetivo</h2><p>Esta Política define como os funcionários registram a jornada de trabalho no sistema Sólides Ponto. Ela vale para o galpão e para as obras. O objetivo é que toda hora trabalhada fique registrada de forma correta, para pagar certo e proteger o funcionário e a empresa.</p><h2>2. A quem se aplica</h2><p>A todos os funcionários com contrato CLT da {{empresa.nome}}, inclusive os técnicos, os encarregados e quem trabalha em obras.</p><h2>3. Sistema e locais de registro</h2><p>O ponto é registrado exclusivamente pelo aplicativo Sólides Ponto, com reconhecimento facial, nos seguintes aparelhos da empresa:</p><table><tbody><tr><th><p>Local</p></th><th><p>Aparelho</p></th><th><p>Quem usa</p></th></tr><tr><td><p>Galpão – Estrada do Rio Grande, 268 – Taquara (Matriz)</p></td><td><p>Tablet fixo na parede</p></td><td><p>Todos que se apresentam no galpão</p></td></tr><tr><td><p>Obra fixas</p></td><td><p>Celular fixo da obra</p></td><td><p>A equipe que vai direto para essa obra</p></td></tr><tr><td><p>Obras eventuais</p></td><td><p>Celulares dos técnicos (volantes)</p></td><td><p>Quem vai direto para uma obra sem aparelho fixo</p></td></tr></tbody></table><p>O aplicativo funciona sem internet: o registro fica salvo no aparelho e sobe para o sistema quando houver sinal. A empresa pode incluir novos aparelhos ou obras fixas, e para isso basta um comunicado interno.</p><h2>4. O que deve ser registrado</h2><ol><li><p><strong>Entrada:</strong> no início da jornada, antes de começar qualquer atividade.</p></li><li><p><strong>Saída para o almoço:</strong> ao parar para o intervalo.</p></li><li><p><strong>Volta do almoço:</strong> ao retomar o trabalho. O intervalo é das {{campo.almoco_inicio}} às {{campo.almoco_fim}}, com no mínimo 1 hora (art. 71 da CLT), e deve ser usufruído por completo. Se em algum dia não for possível fazer o intervalo inteiro, o funcionário deve informar o líder no mesmo dia e fazer a justificativa no aplicativo Sólides.</p></li><li><p><strong>Saída:</strong> no fim da jornada, depois de encerrar as atividades.</p></li><li><p><strong>Saídas durante o expediente</strong> por motivo particular (médico, banco etc.): registrar a saída e o retorno, ou justificar no aplicativo Sólides.</p></li></ol><p>São, portanto, <strong>4 registros por dia</strong>: entrada, saída para o almoço, volta do almoço e saída.</p><p>Horário padrão: {{campo.jornada_inicio}} às {{campo.jornada_fim}}, de segunda a sexta, conforme o contrato de trabalho.</p><p><strong>Tolerância:</strong> variações de até 5 minutos em cada registro, com limite de 10 minutos no dia, não são descontadas nem pagas como hora extra (art. 58, §1º, da CLT).</p><h2>5. Onde registrar em cada situação</h2><table><tbody><tr><th><p>Situação</p></th><th><p>Entrada</p></th><th><p>Saída</p></th></tr><tr><td><p>Começa e termina no galpão (mesmo que vá a obras durante o dia)</p></td><td><p>Tablet do galpão</p></td><td><p>Tablet do galpão</p></td></tr><tr><td><p>Começa no galpão e termina na obra</p></td><td><p>Tablet do galpão</p></td><td><p>Aparelho da obra (fixo ou volante)</p></td></tr><tr><td><p>Vai direto para a obra fixa</p></td><td><p>Celular fixo da obra</p></td><td><p>Celular fixo da obra, ou o aparelho do local onde terminar o dia</p></td></tr><tr><td><p>Vai direto para uma obra eventual</p></td><td><p>Celular volante do técnico</p></td><td><p>Celular volante do técnico</p></td></tr></tbody></table><p>A saída e a volta do almoço são registradas no aparelho do local onde o funcionário estiver na hora do almoço (tablet do galpão, celular fixo da obra ou celular volante).</p><p>Quem vai direto para uma obra precisa ter sido escalado na véspera pelo gestor.</p><p><strong>Deslocamento:</strong> o tempo de deslocamento a partir do galpão, quando a empresa envia o funcionário para a obra, faz parte da jornada. O trajeto de casa até o primeiro local de trabalho (galpão ou obra) não faz parte da jornada (art. 58, §2º, da CLT).</p><h2>6. Identificação e condutas proibidas</h2><p>Todo registro é feito com reconhecimento facial e é pessoal. <strong>É proibido:</strong></p><ul><li><p>registrar o ponto por outra pessoa ou pedir que alguém registre por você;</p></li><li><p>tentar enganar o reconhecimento facial (com foto, vídeo etc.);</p></li><li><p>registrar entrada e ir embora, ou registrar saída e continuar trabalhando;</p></li><li><p>registrar o ponto fora do local de trabalho sem autorização;</p></li><li><p>usar o aparelho de ponto para qualquer outra finalidade;</p></li><li><p>desligar, esconder ou danificar o aparelho de propósito.</p></li></ul><p>Essas condutas são falta grave e ficam sujeitas a advertência, suspensão ou dispensa por justa causa, conforme a gravidade e a reincidência (art. 482 da CLT).</p><h2>7. Aparelhos de ponto</h2><p><strong>7.1 Celular fixo da obra</strong></p><ul><li><p>Cada obra fixa tem um <strong>titular</strong> e um <strong>substituto</strong> nomeados, que assinam um termo de responsabilidade pelo aparelho.</p></li><li><p><strong>Manter o aparelho carregado e funcionando é responsabilidade do titular</strong> (ou do substituto, na ausência dele).</p></li><li><p>Se a obra tiver energia e um local trancado, o aparelho fica ali, carregando, ao fim de cada dia. Se não tiver, o titular leva o aparelho para casa e o traz carregado no dia seguinte.</p></li><li><p>O aparelho tem de estar ligado e disponível <strong>antes do horário de entrada da equipe</strong>.</p></li><li><p>Ao fim da obra, o aparelho é devolvido no galpão.</p></li></ul><p><strong>7.2 Celulares volantes (técnicos)</strong></p><ul><li><p>Cada técnico é responsável pelo aparelho que está com ele e assina um termo de responsabilidade pelo aparelho.</p></li><li><p>Quando houver equipe indo direto para uma obra eventual, o técnico precisa <strong>estar presente na entrada, no almoço e na saída da equipe</strong>. Se não puder, deixa o aparelho com um membro da equipe naquele dia.</p></li><li><p>O horário do técnico nunca pode atrasar nem adiantar o registro da equipe.</p></li></ul><p><strong>7.3 Para todos os aparelhos:</strong> o aparelho deve rodar apenas o aplicativo de ponto. Defeito, perda, furto ou roubo deve ser comunicado ao RH <strong>no mesmo dia</strong>. Furto e roubo exigem boletim de ocorrência.</p><h2>8. Esquecimentos, falhas e ajustes</h2><ol><li><p>Se o funcionário não conseguir registrar o ponto (esquecimento, aparelho sem bateria ou com defeito, falha no reconhecimento facial), deve <strong>avisar o líder no mesmo dia</strong>.</p></li><li><p>Em até <strong>2 dias úteis</strong>, faz a solicitação de ajuste pelo aplicativo Sólides, informando o horário real e o motivo.</p></li><li><p>O gestor confere e aprova ou recusa em até 2 dias úteis.</p></li><li><p>Nenhum horário é alterado sem justificativa. O registro original fica preservado no sistema, e todo ajuste fica identificado.</p></li><li><p>Esquecimentos repetidos (mais de {{campo.limite_esquecimentos}} no mês) sem motivo justificado ficam sujeitos a medidas disciplinares.</p></li></ol><h2>9. Horas extras</h2><p>Hora extra só pode ser feita com <strong>autorização prévia do gestor</strong>. Mesmo assim, toda hora efetivamente trabalhada deve ser registrada no ponto e será paga ou compensada conforme a lei, o contrato e a convenção coletiva. Ninguém pode trabalhar "fora do ponto".</p><h2>10. Consulta, fechamento e espelho de ponto</h2><ul><li><p>Cada funcionário pode consultar os próprios registros e comprovantes pelo Sólides ou pedir ao RH a qualquer momento.</p></li><li><p>O RH revisa as inconsistências <strong>toda semana</strong>.</p></li><li><p>No fechamento mensal, cada funcionário recebe o espelho de ponto para conferir e confirma o espelho pelo aplicativo Sólides ou assinando a via impressa. Divergências devem ser apontadas em até {{campo.prazo_divergencia}} dias úteis.</p></li></ul><h2>11. Dados pessoais</h2><p>A imagem facial e a localização do registro são usadas <strong>apenas</strong> para identificar o funcionário e controlar a jornada, conforme a LGPD e o Termo de Consentimento para Uso de Biometria Facial e Localização.</p><h2>12. Responsabilidades</h2><table><tbody><tr><th><p>Quem</p></th><th><p>Responsabilidade</p></th></tr><tr><td><p>Funcionário</p></td><td><p>Registrar os 4 horários do dia (entrada, saída e volta do almoço, saída) corretamente, avisar falhas no mesmo dia, conferir o espelho mensal</p></td></tr><tr><td><p>Titular/substituto do celular fixo</p></td><td><p>Guarda, carga diária e disponibilidade do aparelho antes da entrada da equipe</p></td></tr><tr><td><p>Técnico (volante)</p></td><td><p>Guarda do aparelho e presença no registro da equipe ou entrega do aparelho a ela</p></td></tr><tr><td><p>Gestor / programação</p></td><td><p>Escalar na véspera quem vai direto para a obra, aprovar ajustes e horas extras</p></td></tr><tr><td><p>RH / administrativo</p></td><td><p>Cadastro no sistema, inventário dos aparelhos, revisão semanal, fechamento mensal, arquivo de documentos</p></td></tr></tbody></table><h2>13. Disposições finais</h2><p>Casos não previstos são decididos pela diretoria. Esta Política pode ser atualizada, e toda mudança será comunicada por escrito aos funcionários.</p><p>Rio de Janeiro/RJ, {{data_emissao_extenso}}.</p><p>Assinatura: ______________________________</p><p>{{responsavel.nome}} – {{responsavel.cargo}} – {{empresa.nome}}</p>$html$,
'[{"chave":"almoco_inicio","rotulo":"Início do almoço","padrao":"12:00"},{"chave":"almoco_fim","rotulo":"Fim do almoço","padrao":"13:00"},{"chave":"jornada_inicio","rotulo":"Início da jornada","padrao":"08:00"},{"chave":"jornada_fim","rotulo":"Fim da jornada","padrao":"17:00"},{"chave":"limite_esquecimentos","rotulo":"Limite de esquecimentos no mês","padrao":"3"},{"chave":"prazo_divergencia","rotulo":"Prazo para apontar divergência (dias úteis)","padrao":"5"}]'::jsonb, 'Carga inicial'
where not exists (select 1 from public.doc_modelos where grupo_id = '7d0c1a10-0001-4000-8000-000000000001');

insert into public.doc_modelos (grupo_id, nome, versao, vigencia, exige_assinatura, coletivo, conteudo_html, campos_extras, criado_por_nome)
select '7d0c1a10-0002-4000-8000-000000000002', 'Termo de Ciência da Política de Controle de Jornada', '1.0', '2026-11-03', true, false,
$html$<h1>Termo de Ciência da Política de Controle de Jornada</h1><p><strong>{{empresa.nome}}</strong> – CNPJ {{empresa.cnpj}}</p><p>Eu, <strong>{{funcionario.nome}}</strong>, CPF {{funcionario.cpf}}, cargo {{funcionario.cargo}}, declaro que:</p><ol><li><p>Recebi uma cópia da Política de Controle de Jornada, versão {{campo.versao_politica}}, e as regras me foram explicadas.</p></li><li><p>Sei que devo registrar minha entrada, a saída para o almoço, a volta do almoço e minha saída pelo aplicativo Sólides Ponto, com reconhecimento facial, no aparelho do local onde estou trabalhando (tablet do galpão, celular fixo da obra ou celular volante do técnico).</p></li><li><p>Sei que devo registrar a saída e a volta do meu intervalo de almoço, que é das {{campo.almoco_inicio}} às {{campo.almoco_fim}}, e que devo usufruir do intervalo completo. Quando isso não for possível, devo informar no mesmo dia.</p></li><li><p>Sei que é proibido registrar o ponto por outra pessoa, pedir que registrem por mim ou trabalhar sem registrar o ponto, e que isso pode levar a advertência, suspensão ou justa causa.</p></li><li><p>Sei que, se eu esquecer ou não conseguir registrar o ponto, devo avisar meu líder no mesmo dia e fazer a justificativa em até 2 dias úteis.</p></li><li><p>Sei que hora extra só pode ser feita com autorização prévia do gestor, e que toda hora trabalhada deve ser registrada.</p></li><li><p>Sei que posso consultar meus registros a qualquer momento e que devo conferir e assinar meu espelho de ponto todo mês.</p></li></ol><p>Rio de Janeiro/RJ, {{data_emissao_extenso}}.</p><p>Assinatura do funcionário: ______________________________</p><p>Assinatura da empresa: ______________________________</p>$html$,
'[{"chave":"versao_politica","rotulo":"Versão da Política","padrao":"1.0"},{"chave":"almoco_inicio","rotulo":"Início do almoço","padrao":"12:00"},{"chave":"almoco_fim","rotulo":"Fim do almoço","padrao":"13:00"}]'::jsonb, 'Carga inicial'
where not exists (select 1 from public.doc_modelos where grupo_id = '7d0c1a10-0002-4000-8000-000000000002');

insert into public.doc_modelos (grupo_id, nome, versao, vigencia, exige_assinatura, coletivo, conteudo_html, campos_extras, criado_por_nome)
select '7d0c1a10-0003-4000-8000-000000000003', 'Termo de Consentimento – Biometria Facial e Localização (LGPD)', '1.0', '2026-11-03', true, false,
$html$<h1>Termo de Ciência e Consentimento para Uso de Biometria Facial e Localização (LGPD)</h1><p><strong>{{empresa.nome}}</strong> – CNPJ {{empresa.cnpj}}, com sede em {{empresa.endereco}} (a "Empresa")</p><p>Eu, <strong>{{funcionario.nome}}</strong>, CPF {{funcionario.cpf}}, declaro que fui informado(a) e concordo com o seguinte:</p><p><strong>1. Quais dados são coletados.</strong> A minha imagem facial, o modelo biométrico gerado a partir dela, a data, a hora e a localização (GPS) de cada registro de ponto, além dos meus dados de cadastro (nome, CPF, cargo).</p><p><strong>2. Para que são usados.</strong> Exclusivamente para: (a) confirmar que sou eu quem está registrando o ponto e evitar fraudes; (b) controlar a minha jornada de trabalho; (c) cumprir obrigações trabalhistas e servir de prova em processos administrativos ou judiciais. Os dados <strong>não</strong> serão usados para nenhuma outra finalidade.</p><p><strong>3. Base legal.</strong> Lei 13.709/2018 (LGPD), art. 11, inciso II, alínea "g" (prevenção à fraude e segurança do titular em processos de identificação), alínea "d" (exercício regular de direitos em processo) e o meu consentimento específico, dado por este Termo.</p><p><strong>4. Com quem são compartilhados.</strong> Com a Sólides, empresa fornecedora do sistema de ponto, que trata os dados em nome da Empresa. Também podem ser compartilhados com a contabilidade, para a folha de pagamento, e com autoridades, quando a lei exigir.</p><p><strong>5. Por quanto tempo são guardados.</strong> A biometria facial fica guardada enquanto durar o meu contrato de trabalho e é excluída em até {{campo.prazo_exclusao_biometria}} dias após o desligamento. Os registros de ponto (data, hora e local) ficam guardados por até 5 anos após o fim do contrato, para cumprir a legislação trabalhista.</p><p><strong>6. Segurança.</strong> O acesso aos dados é restrito às pessoas da Empresa responsáveis pelo RH e pela gestão do ponto. A localização é registrada <strong>somente no momento do registro do ponto</strong>, e não há rastreamento contínuo.</p><p><strong>7. Meus direitos.</strong> Posso, a qualquer momento, pedir informações sobre os meus dados, acesso, correção e demais direitos do art. 18 da LGPD, por meio do RH, e-mail marta@marvservicos.com.br.</p><p><strong>8. Revogação.</strong> Se eu revogar o consentimento, a Empresa vai me oferecer outra forma de identificação para o registro do ponto, e a revogação não me traz prejuízo. Os registros já feitos continuam guardados pelo prazo do item 5.</p><p>Rio de Janeiro/RJ, {{data_emissao_extenso}}.<br><br>Assinatura do funcionário: _______________________________</p><p>Assinatura da empresa: ______________________________</p>$html$,
'[{"chave":"prazo_exclusao_biometria","rotulo":"Prazo para excluir a biometria após o desligamento (dias)","padrao":"90"}]'::jsonb, 'Carga inicial'
where not exists (select 1 from public.doc_modelos where grupo_id = '7d0c1a10-0003-4000-8000-000000000003');

insert into public.doc_modelos (grupo_id, nome, versao, vigencia, exige_assinatura, coletivo, conteudo_html, campos_extras, criado_por_nome)
select '7d0c1a10-0004-4000-8000-000000000004', 'Comunicado de Início Oficial do Controle de Ponto', '1.0', '2026-11-03', false, true,
$html$<h1>Comunicado de Início Oficial do Controle de Ponto</h1><p><strong>{{empresa.nome}}</strong> – Rio de Janeiro/RJ, {{data_emissao}}</p><p><strong>A todos os funcionários</strong></p><p>A partir de <strong>{{campo.data_inicio_oficial}}</strong>, o registro de ponto pelo aplicativo <strong>Sólides Ponto</strong> passa a valer oficialmente para o cálculo da folha de pagamento. A fase de teste termina em {{campo.data_fim_teste}}.</p><p><strong>Onde registrar o ponto:</strong></p><ul><li><p><strong>Veio para o galpão:</strong> no tablet do galpão.</p></li><li><p><strong>Foi direto para a obra de duto:</strong> no celular fixo da obra, que fica com {{campo.titular_celular_obra}}.</p></li><li><p><strong>Foi direto para outra obra:</strong> no celular do técnico responsável por aquela obra.</p></li></ul><p><strong>Lembre-se:</strong></p><ol><li><p>Registre a <strong>entrada</strong> ao chegar e a <strong>saída</strong> ao terminar. Registre também a saída e a volta do almoço: são 4 registros por dia.</p></li><li><p>Cada um registra o <strong>próprio</strong> ponto, com o rosto. Registrar pelo colega é falta grave.</p></li><li><p>Esqueceu ou o aparelho falhou? <strong>Avise seu líder no mesmo dia</strong> e faça a justificativa no aplicativo Sólides em até 2 dias úteis.</p></li><li><p>Hora extra só com autorização prévia do gestor.</p></li><li><p>Todo mês você vai receber o seu espelho de ponto para conferir e assinar.</p></li></ol><p>As regras completas estão na Política de Controle de Jornada, que você recebeu e assinou. Dúvidas: {{campo.contato_duvidas}}, {{campo.contato_telefone_email}}.</p><p>{{responsavel.nome}} – {{responsavel.cargo}}</p><h2>Lista de recebimento do comunicado</h2><p>{{lista_recebimento}}</p>$html$,
'[{"chave":"data_inicio_oficial","rotulo":"Início oficial","padrao":"03/11/2026"},{"chave":"data_fim_teste","rotulo":"Fim da fase de teste","padrao":"02/11/2026"},{"chave":"titular_celular_obra","rotulo":"Titular do celular fixo da obra","padrao":""},{"chave":"contato_duvidas","rotulo":"Dúvidas: nome/setor","padrao":""},{"chave":"contato_telefone_email","rotulo":"Dúvidas: telefone/e-mail","padrao":""}]'::jsonb, 'Carga inicial'
where not exists (select 1 from public.doc_modelos where grupo_id = '7d0c1a10-0004-4000-8000-000000000004');
