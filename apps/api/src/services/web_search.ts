// D:\dev\loyo-os\apps\api\src\services\webSearch.ts
// LOYO OS // ŽIVÉ WEBOVÉ VYHLEDÁVÁNÍ pro Julii — zdarma, bez API klíče (DuckDuckGo HTML)
import * as cheerio from 'cheerio'

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.5',
}

export async function webSearch(query: string, limit = 5): Promise<SearchResult[]> {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(10000),
    })
    console.log(`[WEBSEARCH] DDG "${query}" → ${res.status}`)
    if (!res.ok) return []

    const html = await res.text()
    const $ = cheerio.load(html)
    const results: SearchResult[] = []

    $('.result').each((_: number, el: any) => {
      if (results.length >= limit) return
      const $el = $(el)
      const titleEl = $el.find('.result__a')
      const title = titleEl.text().trim()
      let url = titleEl.attr('href') || ''
      const m = url.match(/uddg=([^&]+)/)
      if (m) url = decodeURIComponent(m[1])
      const snippet = $el.find('.result__snippet').text().trim()
      if (title && url && url.startsWith('http')) results.push({ title, url, snippet })
    })

    return results
  } catch (e) {
    console.error('[WEBSEARCH] DDG error:', (e as Error).message)
    return []
  }
}
