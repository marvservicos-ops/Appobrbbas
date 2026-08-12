export async function converterSeForHeic(file: File): Promise<File> {
  const ehHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.hei[cf]$/i.test(file.name)

  if (!ehHeic) return file

  const heic2any = (await import('heic2any')).default
  const convertido = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
  const blob = Array.isArray(convertido) ? convertido[0] : convertido
  const nome = file.name.replace(/\.hei[cf]$/i, '.jpg')
  return new File([blob], nome, { type: 'image/jpeg' })
}
