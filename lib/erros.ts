// Traduz erros do Supabase/rede para mensagens claras em português.
// Use para o que aparece na tela; o erro original vai para o console.

type ErroLike = { message?: string; code?: string; details?: string } | Error | string | null | undefined

export function mensagemErro(err: ErroLike, contexto?: string): string {
  if (err) console.error(contexto ?? 'Erro', err)
  const msg = typeof err === 'string' ? err : err?.message ?? ''
  const code = typeof err === 'object' && err && 'code' in err ? err.code : undefined
  const prefixo = contexto ? `${contexto}: ` : ''

  if (code === '23505' || /duplicate key/i.test(msg)) return prefixo + 'já existe um cadastro com esses dados.'
  if (code === '23503' || /foreign key/i.test(msg)) return prefixo + 'este item está em uso por outros registros e não pode ser removido.'
  if (code === '23502' || /null value/i.test(msg)) return prefixo + 'falta preencher um campo obrigatório.'
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) return prefixo + 'você não tem permissão para fazer isso.'
  if (code === '22P02' || /invalid input syntax/i.test(msg)) return prefixo + 'algum campo tem um valor inválido.'
  if (/failed to fetch|network|load failed|fetch failed/i.test(msg)) return prefixo + 'sem conexão. Verifique a internet e tente de novo.'
  if (/already been registered|already registered/i.test(msg)) return prefixo + 'este e-mail já está cadastrado.'
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(msg)) return 'E-mail ainda não confirmado.'
  return prefixo + 'não foi possível concluir. Tente de novo.'
}
