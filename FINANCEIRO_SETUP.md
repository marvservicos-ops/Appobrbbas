# Configuração do módulo financeiro

1. Abra o projeto do MARV Gestão no Supabase.
2. Acesse **SQL Editor** e execute todo o arquivo `financeiro_admin_schema.sql`.
3. Confirme em **Table Editor → app_profiles** que `joaovictor@marvservicos.com.br` está com `role = admin`.
4. Confirme em **Storage** que o bucket `notas-fiscais-emitidas` está marcado como privado.
5. Publique o código somente depois da execução da migration.

O acesso financeiro é validado em três camadas:

- páginas administrativas e de pagamentos verificam o perfil no servidor;
- dados de medições são protegidos por RLS;
- notas fiscais ficam em bucket privado e abrem por URL assinada de 60 segundos.
