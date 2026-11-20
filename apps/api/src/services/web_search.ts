// D:\dev\loyo-os\apps\api\src\services\web_search.ts
// LOYO OS // ŽIVÉ WEBOVÉ VYHLEDÁVÁNÍ pro Julii — zdarma, bez API klíče (DuckDuckGo HTML)
// a stahování obsahu nalezených stránek, aby report nestál jen na anotacích.
import * as cheerio from 'cheerio'

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

export interface PageContent {
  title: string
  url: string
  text: string
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.5',
}

function decodeDdgUrl(raw: string): string {
  const m = raw.match(/uddg=([^&]+)/)
  if (m) {
    try { return decodeURIComponent(m[1]) } catch { return raw }
  }
  return raw
}

// html.duckduckgo.com občas vrátí prázdno/robot check — zkusí se lite varianta.
async function fetchSearchHtml(query: string): Promise<string | null> {
  const endpoints = [
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
  ]
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) })
      console.log(`[WEBSEARCH] ${url.split('/')[2]} "${query}" → ${res.status}`)
      if (!res.ok) continue
      const html = await res.text()
      if (html.includes('result__a') || html.includes('result-link')) return html
    } catch (e) {
      console.warn('[WEBSEARCH]', url.split('/')[2], (e as Error).message)
    }
  }
  return null
}

export async function webSearch(query: string, limit = 5): Promise<SearchResult[]> {
  try {
    const html = await fetchSearchHtml(query)
    if (!html) return []

    const $ = cheerio.load(html)
    const results: SearchResult[] = []

    $('.result').each((_: number, el: any) => {
      if (results.length >= limit) return
      const $el = $(el)
      const titleEl = $el.find('.result__a')
      const title = titleEl.text().trim()
      const url = decodeDdgUrl(titleEl.attr('href') || '')
      const snippet = $el.find('.result__snippet').text().trim()
      if (title && url.startsWith('http') && !results.some(r => r.url === url)) {
        results.push({ title, url, snippet })
      }
    })

    // lite.duckduckgo.com má jinou strukturu
    if (!results.length) {
      $('a.result-link').each((_: number, el: any) => {
        if (results.length >= limit) return
        const $el = $(el)
        const title = $el.text().trim()
        const url = decodeDdgUrl($el.attr('href') || '')
        const snippet = $el.closest('tr').next().find('.result-snippet').text().trim()
        if (title && url.startsWith('http') && !results.some(r => r.url === url)) {
          results.push({ title, url, snippet })
        }
      })
    }

    return results
  } catch (e) {
    console.error('[WEBSEARCH] DDG error:', (e as Error).message)
    return []
  }
}

// Stáhne stránku a vrátí hlavní text bez navigace, reklam a skriptů.
export async function fetchPageText(url: string, maxChars = 4500): Promise<string | null> {
  try {
    if (!/^https?:/i.test(url)) return null
    if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|rar|mp4|mp3|exe|dmg)(\?|$)/i.test(url)) return null

    const res = await fetch(url, {
      headers: HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    })
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || !/text\/html|application\/xhtml|text\/plain/i.test(type)) return null

    const html = await res.text()
    const $ = cheerio.load(html)
    $('script,style,noscript,svg,iframe,form,nav,footer,header,aside,button').remove()

    const main = $('main, article').first().text() || $('body').text()
    const text = main.replace(/\s+/g, ' ').trim()
    if (text.length < 200) return null
    return text.slice(0, maxChars)
  } catch (e) {
    console.warn('[WEBSEARCH] page failed:', url, (e as Error).message)
    return null
  }
}

// Přečte několik nejlepších výsledků celé (paralelně) — vrací jen ty, co prošly.
export async function readSources(
  results: SearchResult[],
  limit = 4,
  maxChars = 4500,
): Promise<PageContent[]> {
  const picked = results.slice(0, limit)
  const pages = await Promise.all(
    picked.map(async (r) => {
      const text = await fetchPageText(r.url, maxChars)
      return text ? { title: r.title, url: r.url, text } : null
    }),
  )
  return pages.filter((p): p is PageContent => p !== null)
}
