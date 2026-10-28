import type { User } from '@supabase/supabase-js'
import type { AppProfile } from '@/lib/access'
import { limparHtmlBasico } from '@/lib/apiAuth'

const DOMINIO_VERIFICADO = '@marvservicos.com.br'

// Remetente de e-mails enviados pelo sistema: sempre de quem está logado
// (nunca do corpo da requisição). Só usa o e-mail do usuário se for do domínio
// verificado no Resend; senão cai no remetente padrão.
export function remetenteDaSessao(user: User, profile: AppProfile | null, padrao: string) {
  const email = (profile?.email || user.email || '').trim()
  const nome = (profile?.nome || (user.user_metadata?.nome as string | undefined) || '').trim()
  const emailValido = email.toLowerCase().endsWith(DOMINIO_VERIFICADO)
  const nomeSeguro = (nome || 'MARV Serviços').replace(/[<>"]/g, '')

  // Assinatura salva em Configurações > Meu Perfil (user_metadata.assinatura_email).
  const assinaturaSalva = user.user_metadata?.assinatura_email
  const assinaturaHtml = typeof assinaturaSalva === 'string' && assinaturaSalva.trim()
    ? limparHtmlBasico(assinaturaSalva)
    : null

  return {
    emailValido,
    email: emailValido ? email : padrao,
    nome: nome || null,
    from: emailValido ? `${nomeSeguro} <${email}>` : `MARV Serviços <${padrao}>`,
    copiaPara: email || null,
    assinaturaHtml,
  }
}
