import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'

const CHROMIUM_PACK_URL = 'https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar'

// Gera um PDF por URL, reaproveitando um único browser (mais rápido que abrir um por PDF).
export async function gerarPdfsDeUrls(urls: string[]): Promise<Buffer[]> {
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
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 25000 })
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
