import { redirect } from 'next/navigation'

export default function PagamentosPage({ params }: { params: { id: string } }) {
  redirect(`/obras/${params.id}/financeiro`)
}
