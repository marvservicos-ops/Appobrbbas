import { redirect } from 'next/navigation'
import { getCurrentProfile, profileCan } from '@/lib/access'
import ObraPagamentos from '@/components/ObraPagamentos'

export default async function PagamentosPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile()
  if (!profileCan(profile, 'financeiro')) redirect(`/obras/${params.id}`)
  return <ObraPagamentos obraId={params.id} />
}
