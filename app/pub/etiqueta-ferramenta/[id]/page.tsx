import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EtiquetaPrintButton from '@/components/EtiquetaPrintButton'

export default async function EtiquetaFerramentaPage({ params }: { params: { id: string } }) {
  const sb = await createClient()
  const { data: ferramenta } = await sb.from('ferramentas').select('*').eq('id', params.id).single()
  if (!ferramenta) notFound()

  const f = ferramenta as any
  const pubUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://marv-gestao.vercel.app'}/pub/ferramenta/${params.id}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=6&data=${encodeURIComponent(pubUrl)}`

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { font-family: 'Helvetica Neue', Arial, sans-serif; background: white; height: 100%; }
        .label {
          width: 70mm;
          height: 100mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 6mm;
          gap: 4mm;
          overflow: hidden;
          border: 0.4mm dashed #94A3B8;
        }
        .logo-img { height: 9mm; width: auto; object-fit: contain; display: block; margin: 0 auto; }
        .ativo-nome {
          font-size: 13px;
          font-weight: 700;
          color: #0F172A;
          line-height: 1.3;
          text-align: center;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
        }
        .qr img { width: 46mm; height: 46mm; object-fit: contain; display: block; }
        .scan-text { font-size: 6.5px; font-weight: 700; color: #0F172A; text-align: center; line-height: 1.4; }
        @media screen {
          body { background: #F1F5F9; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 24px; }
          .label { background: white; box-shadow: 0 4px 24px #0002; border-radius: 4px; transform: scale(1.6); transform-origin: center center; margin: 70px 0; }
          .print-btn { background: #4F7CFF; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px #4F7CFF66; }
        }
        @media print {
          @page { margin: 0; }
          html, body { width: 100%; height: 100%; }
          body { background: white; display: flex; align-items: center; justify-content: center; }
          .print-btn { display: none; }
        }
      `}</style>

      <div className="label">
        <img src="/marv-logo.png" alt="MARV" className="logo-img" />
        <div className="ativo-nome">{f.nome}</div>
        <div className="qr">
          <img src={qrUrl} alt="QR Code" />
        </div>
        <div className="scan-text">Escaneie para<br />ver a ficha</div>
      </div>

      <EtiquetaPrintButton />
    </>
  )
}
