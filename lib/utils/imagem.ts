import { converterSeForHeic } from './heic'

// Foto do celular pode passar de 5 MB (o limite do envio para a API é 4,5 MB).
// Converte HEIC e reduz para no máximo `lado` px no lado maior, em JPEG.
// PDF e arquivos que não são imagem passam direto.
export async function prepararImagem(file: File, lado = 2000): Promise<File> {
  const f = await converterSeForHeic(file)
  if (!f.type.startsWith('image/') || f.size < 800_000) return f
  try {
    const bitmap = await createImageBitmap(f)
    const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.85))
    if (!blob || blob.size >= f.size) return f
    return new File([blob], f.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return f
  }
}
