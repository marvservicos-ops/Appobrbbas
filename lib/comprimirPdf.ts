// Reduz o tamanho de PDFs pesados (ex.: relatórios do Diário de Obra cheios de fotos)
// recomprimindo as imagens internas: diminui a resolução e salva de novo em JPEG.
// Texto, tabelas e desenhos vetoriais não mudam.
import { inflateSync } from 'zlib'
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef } from 'pdf-lib'
import sharp from 'sharp'

export interface NivelCompressao { maxLado: number; qualidade: number }

// Do mais leve ao mais agressivo — o envio tenta um por vez até caber no limite
export const NIVEIS_COMPRESSAO: NivelCompressao[] = [
  { maxLado: 2000, qualidade: 75 },
  { maxLado: 1500, qualidade: 62 },
  { maxLado: 1100, qualidade: 50 },
]

const N = (s: string) => PDFName.of(s)

function filtros(dict: PDFDict): string[] {
  const f = dict.get(N('Filter'))
  if (f instanceof PDFName) return [f.decodeText()]
  if (f instanceof PDFArray) return f.asArray().map(x => (x instanceof PDFName ? x.decodeText() : '?'))
  return []
}

// Quantos canais de cor a imagem tem (1 = cinza, 3 = RGB). Outros espaços de cor ficam de fora.
function canais(doc: PDFDocument, dict: PDFDict): 1 | 3 | null {
  let cs = dict.get(N('ColorSpace'))
  if (cs instanceof PDFRef) cs = doc.context.lookup(cs)
  if (cs instanceof PDFName) {
    const nome = cs.decodeText()
    return nome === 'DeviceRGB' ? 3 : nome === 'DeviceGray' ? 1 : null
  }
  if (cs instanceof PDFArray && cs.size() === 2 && cs.get(0) === N('ICCBased')) {
    const perfil = doc.context.lookup(cs.get(1))
    const n = perfil instanceof PDFRawStream ? perfil.dict.get(N('N')) : undefined
    const v = n instanceof PDFNumber ? n.asNumber() : 0
    return v === 3 ? 3 : v === 1 ? 1 : null
  }
  return null
}

function numero(dict: PDFDict, chave: string): number {
  const v = dict.get(N(chave))
  return v instanceof PDFNumber ? v.asNumber() : 0
}

export async function comprimirPdf(original: Buffer, nivel: NivelCompressao): Promise<Buffer> {
  const doc = await PDFDocument.load(original, { updateMetadata: false, ignoreEncryption: true })
  const ctx = doc.context

  // Máscaras de transparência (SMask/Mask) ficam como estão
  const mascaras = new Set<string>()
  for (const [, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue
    for (const chave of ['SMask', 'Mask']) {
      const m = obj.dict.get(N(chave))
      if (m instanceof PDFRef) mascaras.add(m.toString())
    }
  }

  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue
    const dict = obj.dict
    if (dict.get(N('Subtype')) !== N('Image') || mascaras.has(ref.toString())) continue
    if (dict.get(N('ImageMask')) || dict.get(N('Decode')) || numero(dict, 'BitsPerComponent') !== 8) continue
    const ch = canais(doc, dict)
    if (!ch) continue
    const largura = numero(dict, 'Width')
    const altura = numero(dict, 'Height')
    const bytesAntes = obj.contents.length
    if (bytesAntes < 60 * 1024) continue // imagem pequena: não vale a pena

    try {
      const f = filtros(dict)
      let entrada: ReturnType<typeof sharp>
      if (f.length === 1 && f[0] === 'DCTDecode') {
        entrada = sharp(Buffer.from(obj.contents), { failOn: 'none' })
      } else if (f.length === 1 && f[0] === 'FlateDecode' && !dict.get(N('DecodeParms'))) {
        const pixels = inflateSync(Buffer.from(obj.contents))
        if (pixels.length !== largura * altura * ch) continue
        entrada = sharp(pixels, { raw: { width: largura, height: altura, channels: ch } })
      } else {
        continue
      }

      const precisaReduzir = Math.max(largura, altura) > nivel.maxLado
      let p = entrada
      if (precisaReduzir) p = p.resize({ width: nivel.maxLado, height: nivel.maxLado, fit: 'inside', withoutEnlargement: true })
      p = ch === 1 ? p.grayscale() : p.toColourspace('srgb')
      const { data, info } = await p.jpeg({ quality: nivel.qualidade, mozjpeg: true }).toBuffer({ resolveWithObject: true })
      if (data.length >= bytesAntes * 0.9) continue // não ganhou quase nada

      const novoDict = dict.clone(ctx)
      novoDict.set(N('Filter'), N('DCTDecode'))
      novoDict.delete(N('DecodeParms'))
      novoDict.set(N('Width'), PDFNumber.of(info.width))
      novoDict.set(N('Height'), PDFNumber.of(info.height))
      novoDict.set(N('ColorSpace'), N(ch === 1 ? 'DeviceGray' : 'DeviceRGB'))
      novoDict.set(N('BitsPerComponent'), PDFNumber.of(8))
      ctx.assign(ref, PDFRawStream.of(novoDict, new Uint8Array(data)))
    } catch {
      // Imagem que o sharp não entende: mantém a original
    }
  }

  return Buffer.from(await doc.save({ useObjectStreams: true }))
}
