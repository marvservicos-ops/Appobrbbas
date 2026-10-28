import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'

const CHROMIUM_PACK_URL = 'https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar'

export type CookieSessao = { name: string; value: string }

// Gera um PDF por URL, reaproveitando um único browser (mais rápido que abrir um por PDF).
// `cookies`: cookies da sessão de quem pediu o PDF. As páginas /print exigem login
// (middleware + RLS no navegador); sem eles o Puppeteer imprimiria a tela de login.
// `seletorPronto`: elemento que a página só renderiza depois que os dados chegaram.
export async function gerarPdfsDeUrls(
  urls: string[],
  opcoes: { cookies?: CookieSessao[]; seletorPronto?: string } = {},
): Promise<Buffer[]> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 1 },
    executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
    headless: true,
  })

  try {
    return await Promise.all(urls.map(async url => {
      const page = await browser.newPage()
      try {
        // A página de impressão chama window.print() sozinha quando carrega — no
        // headless isso só atrapalha.
        await page.evaluateOnNewDocument(() => { window.print = () => {} })

        if (opcoes.cookies?.length) {
          const { hostname, protocol } = new URL(url)
          await page.setCookie(...opcoes.cookies.map(c => ({
            name: c.name,
            value: c.value,
            domain: hostname,
            path: '/',
            httpOnly: false,
            secure: protocol === 'https:',
            sameSite: 'Lax' as const,
          })))
        }

        await page.goto(url, { waitUntil: 'networkidle0', timeout: 25000 })
        if (new URL(page.url()).pathname.startsWith('/login')) {
          throw new Error('Não foi possível gerar o PDF (sessão)')
        }
        if (opcoes.seletorPronto) {
          await page.waitForSelector(opcoes.seletorPronto, { timeout: 15000 }).catch(() => {
            throw new Error('Não foi possível gerar o PDF (a página do relatório não carregou)')
          })
          // fotos/logos carregam depois dos dados
          await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 }).catch(() => {})
        }
        const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
        return Buffer.from(pdf)
      } finally {
        await page.close()
      }
    }))
  } finally {
    await browser.close()
  }
}
