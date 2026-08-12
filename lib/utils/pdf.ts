export function validarPdf(file: File): string | null {
  const ehPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!ehPdf) return 'Selecione um arquivo PDF.'
  return null
}
