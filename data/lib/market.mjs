// data/lib/market.mjs
// Společné stahování a čtení trhu (Sbazar, Aukro) pro agenty LOYO OS.
// Bez závislostí (Node 20+). Zatím ho používá Ostř; Stěpán má stejný kód u sebe.

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

export function decodeEntities(input) {
  return String(input).replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const num = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(num) ? String.fromCodePoint(num) : match
    }
    return ENTITIES[code.toLowerCase()] ?? match
  })
}

export function stripTags(input) {
  return decodeEntities(String(input).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

export function normalize(input) {
  return String(input)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function hasWord(text, phrase) {
  return ` ${text} `.includes(` ${phrase} `)
}

export function parsePrice(raw) {
  if (raw === null || raw === undefined) return null
  const digits = String(raw).replace(/[^\d]/g, '')
  if (!digits) return null
  const value = Number(digits)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function formatCzk(value) {
  return `${Math.round(value).toLocaleString('cs-CZ').replace(/ /g, ' ')} Kč`
}

// "89 %" a podobné údaje do hledání nepatří
export function buildQueryTokens(text, stopwords = []) {
  const stop = new Set(stopwords.map(normalize))
  const cleaned = String(text).replace(/\b\d+\s*(%|procent\w*)/gi, ' ')
  const words = normalize(cleaned).split(' ').filter(Boolean)
  return [...new Set(words.filter((w) => w.length >= 2 && !stop.has(w)))]
}

export async function fetchHtml(url, timeoutMs = 20000) {
  let lastError
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        // Pozor: hlavička Accept spouští na Sbazaru redirect loop — neposílat.
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'cs-CZ,cs;q=0.9' },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} (${res.statusText})`)
        err.status = res.status
        throw err
      }
      return await res.text()
    } catch (err) {
      lastError = err
      // 403/429 = portál nás nechce, druhý pokus nemá smysl
      if (err?.status === 403 || err?.status === 429) break
      if (attempt === 0) await sleep(800)
    }
  }
  throw lastError
}

export function parseSbazar(html, query) {
  const offers = []
  const chunks = html.split('<li data-offer-id="')
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i]
    const id = chunk.slice(0, Math.max(0, chunk.indexOf('"')))
    const hrefMatch = chunk.match(/href="(\/(?:inzerat|rozbalena-nabidka)\/[^"]+)"/)
    if (!hrefMatch) continue
    const titleMatch =
      chunk.match(/class="text-red[^"]*"[^>]*>([^<]+)</) || chunk.match(/<img[^>]+alt="([^"]+)"/)
    const priceMatch =
      chunk.match(/<b[^>]*class="[^"]*text-neutral-black[^"]*"[^>]*>([^<]+)<\/b>/) ||
      chunk.match(/<b[^>]*>([\d\s ]+Kč)<\/b>/)
    const locationMatch = chunk.match(/<span[^>]*class="[^"]*whitespace-pre[^"]*"[^>]*>([^<]*)<\/span>/)
    const price = parsePrice(priceMatch?.[1])
    if (price === null) continue
    offers.push({
      id: `sbazar-${id}`,
      portal: 'Sbazar',
      title: stripTags(titleMatch?.[1] ?? ''),
      price,
      location: stripTags(locationMatch?.[1] ?? ''),
      url: `https://www.sbazar.cz${hrefMatch[1]}`,
      query,
    })
  }
  return offers
}

export function parseAukro(html, query) {
  const offers = []
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  for (const block of blocks) {
    let json
    try {
      json = JSON.parse(block[1])
    } catch {
      continue
    }
    const list =
      json?.mainEntity?.['@type'] === 'ItemList'
        ? json.mainEntity.itemListElement
        : json?.['@type'] === 'ItemList'
          ? json.itemListElement
          : null
    if (!Array.isArray(list)) continue
    for (const item of list) {
      const url = item?.url
      const title = decodeEntities(item?.name ?? '')
      const price = parsePrice(item?.offers?.price)
      if (!url || !title || price === null) continue
      const category = String(item?.offers?.category ?? '').split('/').filter(Boolean).pop() ?? ''
      offers.push({
        id: `aukro-${item?.sku ?? url.split('-').pop()}`,
        portal: 'Aukro',
        title: stripTags(title),
        price,
        location: category,
        url,
        query,
      })
    }
  }
  return offers
}

export function portalUrl(portal, query) {
  return portal === 'sbazar'
    ? `https://www.sbazar.cz/hledej/${encodeURIComponent(query)}`
    : `https://aukro.cz/vyhledavani?text=${encodeURIComponent(query)}`
}

// Stejná věc, ne podobná: musí sedět všechny tokeny s číslem (model, kapacita),
// aspoň jedno slovo názvu, a nesmí to být příslušenství / díly.
export function isComparable(offer, tokens, config = {}) {
  if (!offer.title || !offer.price) return false
  if (offer.price < Number(config.minPriceCzk ?? 100)) return false
  const title = normalize(offer.title)
  const compact = title.replace(/\s+/g, '')
  const hit = (token) => hasWord(title, token) || compact.includes(token)
  const digits = tokens.filter((t) => /\d/.test(t))
  const words = tokens.filter((t) => !/\d/.test(t))
  if (digits.length && !digits.every(hit)) return false
  if (words.length && !words.some(hit)) return false
  const excluded = (config.excludeKeywords ?? []).map(normalize).filter((w) => w && !tokens.includes(w))
  if (excluded.some((w) => hasWord(title, w) || compact.includes(w))) return false
  // "iPhone 13" není "iPhone 13 mini/Pro/Max" — jiná varianta = jiná cena
  const variants = (config.variantKeywords ?? []).map(normalize).filter((w) => w && !tokens.includes(w))
  if (variants.some((w) => hasWord(title, w))) return false
  return true
}

// Projde portály od nejkonkrétnějšího dotazu; když je málo srovnatelných, zobecní.
export async function scanMarket(tokens, config = {}, log = console.log) {
  const maxTokens = Math.max(1, Number(config.maxQueryTokens ?? 4))
  const portals = config.portals ?? ['sbazar', 'aukro']
  const timeoutMs = Number(config.requestTimeoutMs ?? 20000)
  const minComparable = Number(config.minComparableCount ?? 3)

  const variants = []
  for (const size of [maxTokens, Math.min(maxTokens, 3), 2]) {
    const q = tokens.slice(0, Math.max(1, size)).join(' ')
    if (q && !variants.includes(q)) variants.push(q)
  }

  const errors = []
  const blocked = new Set()
  const seen = new Map()
  let query = variants[0] ?? ''
  let comparables = []

  for (const variant of variants) {
    query = variant
    for (const portal of portals) {
      if (blocked.has(portal)) continue
      try {
        const html = await fetchHtml(portalUrl(portal, variant), timeoutMs)
        const offers = portal === 'sbazar' ? parseSbazar(html, variant) : parseAukro(html, variant)
        for (const offer of offers) if (!seen.has(offer.url)) seen.set(offer.url, offer)
        log(`[${portal}] "${variant}" → ${offers.length} nabídek`)
      } catch (err) {
        if (portal === 'aukro' && err?.status === 404) {
          log(`[aukro] "${variant}" → dotaz neexistuje, přeskakuji`)
        } else {
          if (err?.status === 403 || err?.status === 429) blocked.add(portal)
          errors.push(`${portal} "${variant}": ${err?.message ?? err}`)
        }
      }
      await sleep(Number(config.delayMs ?? 400))
    }
    comparables = [...seen.values()]
      .filter((o) => isComparable(o, tokens, config))
      .sort((a, b) => a.price - b.price)
    if (comparables.length >= minComparable) break
  }

  return { query, variants, comparables, errors, rawCount: seen.size }
}
