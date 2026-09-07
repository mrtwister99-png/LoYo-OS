// D:\dev\loyo-os\apps\api\src\services\finder.ts
// LOYO OS // Produkční finder
// ZDROJ 1: ARES (oficiální registr → reálné kontakty) pro zdravotnictví/školství
// ZDROJ 2: Firmy.cz (EN, SSR) + DNS web-check pro ostatní obory
import * as cheerio from 'cheerio'
import { resolve4 } from 'node:dns/promises'

const FIRMY_BASE = 'https://www.firmy.cz' // CZ verze — dotazy chodí česky, tak ať sedí i výsledky
const ARES_BASE = 'https://ares.gov.cz/ekonomicke-subjekty'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9,cs;q=0.5',
}

export interface FoundBusiness {
  ico: string
  name: string
  address: string
  category: string
  hasWebsite: boolean
  website: string | null
  phone: string | null
  email: string | null
}

interface RawCard { name: string; address: string; webUrl: string | null; phone: string | null; socialOnly: boolean }

// facebook/instagram = NENÍ vlastní web → taková firma je lead
const SOCIAL = /facebook\.com|instagram\.com|twitter\.com|x\.com|linkedin\.com|youtube\.com|tiktok\.com|wa\.me/i

// ---------- ARES obory (NRPZS = zdravotnictví, RŠ = školství) ----------
const ARES_OBORY = [
  { keys: ['zubn', 'stomatolog', 'ordinace', 'klinik', 'lekar', 'zdravot'], nace: ['86.21', '86.22', '86.23', '86.90'], source: 'nrpzs' as const, label: 'Zdravotnické zařízení' },
  { keys: ['skola', 'skolka', 'gymnaz', 'ucili', 'vzdelav'], nace: ['85.1', '85.2', '85.3', '85.4'], source: 'rs' as const, label: 'Škola / vzdělávání' },
]

const strip = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function matchAresObor(query: string) {
  const q = strip(query)
  return ARES_OBORY.find(m => m.keys.some(k => q.includes(k))) ?? null
}

// ============================================================
// ZDROJ 1: ARES (POST search + GET detail s kontakty)
// ============================================================
async function aresSearch(nace: string[], city: string, limit: number): Promise<any[]> {
  try {
    const res = await fetch(`${ARES_BASE}/vyhledat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'LoyoOS/1.0' },
      body: JSON.stringify({ czNace: nace, pocet: limit, start: 0 }),
      signal: AbortSignal.timeout(10000),
    })
    console.log('[ARES] POST vyhledat →', res.status)
    if (!res.ok) return []
    const data = (await res.json()) as any
    let subs = data.ekonomickeSubjekty ?? []
    if (city) subs = subs.filter((s: any) => strip(s.sidlo?.nazevObce || s.sidlo?.textovaAdresa || '').includes(strip(city)))
    return subs
  } catch (e) {
    console.error('[ARES] error:', (e as Error).message)
    return []
  }
}

async function aresKontakty(ico: string, source: 'nrpzs' | 'rs') {
  try {
    const res = await fetch(`${ARES_BASE}-${source}/${ico}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'LoyoOS/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { phone: null, email: null, www: null }
    const d = (await res.json()) as any
    const k = d.zaznamy?.[0]?.kontakty
    if (!k) return { phone: null, email: null, www: null }
    return {
      phone: k.telefon ?? null,
      email: Array.isArray(k.email) ? (k.email[0] ?? null) : (k.email ?? null),
      www: k.www ?? null,
    }
  } catch {
    return { phone: null, email: null, www: null }
  }
}

// ============================================================
// ZDROJ 2: Firmy.cz scrape
// ============================================================
const RE_ADDR = /([A-Za-z0-9Á-ž .-]{2,45}\d{1,5}[a-z]?(?:[/]\d+[a-z]?)?,\s*[A-Za-z0-9Á-ž .-]{2,40})/
const RE_PHONE = /([+]420[ -]?\d{3}[ -]?\d{3}[ -]?\d{3})|(?:^|\D)(\d{3}[ -]\d{3}[ -]\d{3})(?:\D|$)/
const RE_RATING = /^\d[.,]\d/

// fulltextové vyhledávání — funguje pro libovolný obor + město, žádný pevný seznam kategorií není potřeba
async function fetchPage(searchTerm: string, page: number): Promise<string | null> {
  try {
    const url = `${FIRMY_BASE}/?q=${encodeURIComponent(searchTerm)}${page > 1 ? `&page=${page}` : ''}`
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(15000),
    })
    console.log(`[FIRMY] page ${page} (${searchTerm}) → ${res.status}`)
    if (!res.ok) return null
    return await res.text()
  } catch (e) {
    console.error('[FIRMY] fetch error:', (e as Error).message)
    return null
  }
}

function extractCard($: cheerio.CheerioAPI, el: any): RawCard | null {
  const $el = $(el)
  const text = $el.text().replace(/\s+/g, ' ').trim()
  if (text.length < 20) return null

  let name = $el.find('h1 a, h2 a, h3 a, h4 a').first().text().trim()
  if (!name) name = $el.find('a').first().text().trim()
  if (!name || name.length < 2 || name.length > 80) return null

  const addr = text.match(RE_ADDR)?.[1]?.trim() ?? ''
  const phoneM = text.match(RE_PHONE)
  const phone = phoneM ? (phoneM[1] || phoneM[2] || null) : null

  const allLinks = $el.find('a[href^="http"]').toArray().map((a: any) => $(a).attr('href')!)
  const webUrl = allLinks.find(h => !/firmy\.cz|seznam\.cz|mapy\.cz/i.test(h) && !SOCIAL.test(h)) ?? null
  const socialOnly = !webUrl && allLinks.some(h => SOCIAL.test(h))

  return { name, address: addr, webUrl, phone, socialOnly }
}

function parseCards(html: string): RawCard[] {
  const $ = cheerio.load(html)
  let cards: RawCard[] = []

  for (const sel of ['article', '[class*="company" i]', '[class*="card" i]']) {
    const $els = $(sel)
    if ($els.length >= 3) {
      const parsed = $els.toArray().map(el => extractCard($, el)).filter((c): c is RawCard => !!c)
      if (parsed.length >= 3) { cards = parsed; break }
    }
  }

  if (cards.length === 0) {
    const lines = $('body').text().split(/\n+/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
    for (let i = 0; i < lines.length - 1; i++) {
      if (RE_RATING.test(lines[i + 1]) && lines[i].length > 2 && lines[i].length < 80) {
        const block = lines.slice(i, i + 8).join(' · ')
        const phoneM = block.match(RE_PHONE)
        cards.push({
          name: lines[i],
          address: block.match(RE_ADDR)?.[1]?.trim() ?? '',
          webUrl: null,          // v textovém fallbacku nerozhodujeme, rozhodne DNS
          phone: phoneM ? (phoneM[1] || phoneM[2] || null) : null,
          socialOnly: false,
        })
      }
    }
  }

  const seen = new Set<string>()
  return cards.filter(c => {
    const k = strip(c.name)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

async function checkWeb(name: string): Promise<boolean> {
  const base = strip(name)
    .replace(/\b(s\s*r\s*o|sro|v\s*o\s*s|vos|a\s*s|spol)\b/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (base.length < 3) return false
  for (const d of [`${base}.cz`, `${base}.com`, `${base}.eu`]) {
    try { await resolve4(d); return true } catch { /* next */ }
  }
  return false
}

// ============================================================
// HLAVNÍ FUNKCE — API nejdřív, scraping potom
// ============================================================
export async function findBusinessesWithoutWeb(
  query: string,
  city: string,
  limit = 50,
): Promise<FoundBusiness[]> {
  // ---------- ZDROJ 1: ARES ----------
  const aresObor = matchAresObor(query)
  if (aresObor) {
    const subs = await aresSearch(aresObor.nace, city, limit)
    if (subs.length > 0) {
      const results: FoundBusiness[] = []
      for (let i = 0; i < subs.slice(0, limit).length; i += 5) {
        const chunk = subs.slice(i, i + 5)
        const mapped = await Promise.all(chunk.map(async (s: any): Promise<FoundBusiness> => {
          const k = await aresKontakty(s.ico, aresObor.source)
          return {
            ico: s.ico ?? '',
            name: s.obchodniJmeno ?? '???',
            address: s.sidlo?.textovaAdresa ?? '',
            category: aresObor.label,
            hasWebsite: !!k.www,
            website: k.www,
            phone: k.phone,
            email: k.email,
          }
        }))
        results.push(...mapped)
      }
      console.log(`[FINDER] ARES: ${results.length} | withoutWeb: ${results.filter(r => !r.hasWebsite).length}`)
      return results
    }
    console.log('[ARES] žádná data / blokace → fallback Firmy.cz')
  }

  // ---------- ZDROJ 2: Firmy.cz — fulltext, funguje pro libovolný obor ----------
  const searchTerm = `${query} ${city}`.trim()
  const cityNorm = strip(city)
  const collected: RawCard[] = []

  for (let page = 1; page <= 3; page++) {
    const html = await fetchPage(searchTerm, page)
    if (!html) break
    const cards = parseCards(html).filter(c => strip(c.address).includes(cityNorm))
    const before = collected.length
    collected.push(...cards)
    console.log(`[FINDER] page ${page}: +${collected.length - before} (${city})`)
    if (collected.length >= limit || cards.length === 0) break
  }

  const sliced = collected.slice(0, limit)
  const results: FoundBusiness[] = []
  for (let i = 0; i < sliced.length; i += 5) {
    const chunk = sliced.slice(i, i + 5)
    const mapped = await Promise.all(
      chunk.map(async (c): Promise<FoundBusiness> => {
        const dns = c.webUrl ? true : c.socialOnly ? false : await checkWeb(c.name)
        return {
          ico: '',
          name: c.name,
          address: c.address,
          category: query, // u fulltextu nemáme pevný label, použijeme přímo zadaný obor
          hasWebsite: dns,
          website: c.webUrl && c.webUrl !== 'web-link' ? c.webUrl : null,
          phone: c.phone,
          email: null,
        }
      }),
    )
    results.push(...mapped)
  }

  console.log(`[FINDER] Firmy.cz: ${results.length} | withoutWeb: ${results.filter(r => !r.hasWebsite).length}`)
  return results
}