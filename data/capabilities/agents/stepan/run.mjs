#!/usr/bin/env node
// data/capabilities/agents/stepan/run.mjs
// Stěpán — opak Lopatinky: dostane věc, zjistí co to je a za kolik se prodává,
// a napíše inzerát na prodej. Bez závislostí (Node 20+).
//
// Použití:
//   node run.mjs --item "iPhone 13 128 GB, baterie 89 %, drobné škrábance"
//   node run.mjs --item "PlayStation 5 Slim" --condition jako-novy
//
// ENV:
//   STEPAN_ITEM        (totéž jako --item; používá API, aby se nemusely escapovat argumenty)
//   STEPAN_CONDITION   (totéž jako --condition)
//   STEPAN_PRICE       (totéž jako --price / --cena: tvoje přibližná cena, jde do inzerátu)
//   STEPAN_PHOTOS      (totéž jako --fotky: složka nebo soubory oddělené ;)
//   STEPAN_POST=1      (totéž jako --vlozit: po napsání předvyplní inzerát na Sbazaru, nezveřejní)
//
// Výstup: report inzerat_*.md, state.json, audit.json, memory.json a text do UI chatu.

import { readFile, writeFile, readdir, rename, mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { priceStats } from '../../../lib/pricing.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = join(__dirname, 'config.json')
const STATE_PATH = join(__dirname, 'state.json')
const AUDIT_PATH = join(__dirname, 'audit.json')
const MEMORY_PATH = join(__dirname, 'memory.json')

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- pomocné ----------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decodeEntities(input) {
  return String(input).replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const num = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(num) ? String.fromCodePoint(num) : match
    }
    const key = code.toLowerCase()
    return ENTITIES[key] ?? match
  })
}

function stripTags(input) {
  return decodeEntities(String(input).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function normalize(input) {
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function hasWord(text, phrase) {
  return ` ${text} `.includes(` ${phrase} `)
}

function parsePrice(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/[^\d]/g, '')
  if (!digits) return null
  const value = Number(digits)
  return Number.isFinite(value) && value > 0 ? value : null
}

function formatCzk(value) {
  return `${Math.round(value).toLocaleString('cs-CZ').replace(/\u00a0/g, ' ')} Kč`
}

function truncate(text, max) {
  const clean = String(text).replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[,;:]$/, '')}…`
}

function nowStamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`
}

function czechDate(date = new Date()) {
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Prague',
  }).format(date)
}

// ---------- co to je / v jakém stavu ----------
// % baterie a podobné číselné údaje do hledání nepatří — "89 %" by rozbilo dotaz
function cleanItemText(text) {
  return String(text).replace(/\b\d+\s*(%|procent\w*)/gi, ' ').replace(/\s+/g, ' ').trim()
}

function detectCondition(text, config) {
  const t = normalize(text)
  const rules = config.conditionDetection ?? []
  for (const rule of rules) {
    if (rule.any?.some((word) => hasWord(t, normalize(word)))) return rule.id
  }
  return null
}

function resolveCondition(config, requested, text) {
  const conditions = config.conditions ?? {}
  const pick = (id) => (id && conditions[id] ? { id, ...conditions[id] } : null)
  return (
    pick(requested) ??
    pick(detectCondition(text, config)) ??
    pick(config.defaultCondition) ?? { id: 'dobry', label: 'Dobrý', factor: 0.88 }
  )
}

// slova, která nejsou součástí názvu věci (stav, kontakt, doprava…)
function buildQueryTokens(item, config) {
  const stop = new Set((config.stopwords ?? []).map(normalize))
  const words = normalize(cleanItemText(item)).split(' ').filter(Boolean)
  // jednociferné číslo nese model (PlayStation 5, iPhone 8) — nesmí vypadnout
  return [...new Set(words.filter((w) => (w.length >= 2 || /^\d$/.test(w)) && !stop.has(w)))]
}

// ---------- stahování ----------
async function fetchHtml(url, timeoutMs) {
  let lastError
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          // Pozor: hlavička Accept spouští na Sbazaru redirect loop — neposílat.
          'User-Agent': USER_AGENT,
          'Accept-Language': 'cs-CZ,cs;q=0.9',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} (${res.statusText})`)
      return await res.text()
    } catch (err) {
      lastError = err
      if (attempt === 0) await sleep(800)
    }
  }
  throw lastError
}

// ---------- Sbazar ----------
function parseSbazar(html, query) {
  const offers = []
  const chunks = html.split('<li data-offer-id="')
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i]

    const id = chunk.slice(0, Math.max(0, chunk.indexOf('"')))
    const hrefMatch = chunk.match(/href="(\/(?:inzerat|rozbalena-nabidka)\/[^"]+)"/)
    if (!hrefMatch) continue

    const titleMatch =
      chunk.match(/class="text-red[^"]*"[^>]*>([^<]+)</) || chunk.match(/<img[^>]+alt="([^"]+)"/)
    const priceMatch = chunk.match(/<b[^>]*class="[^"]*text-neutral-black[^"]*"[^>]*>([^<]+)<\/b>/)
      || chunk.match(/<b[^>]*>([\d\s\u00a0]+Kč)<\/b>/)
    const locationMatch = chunk.match(/<span[^>]*class="[^"]*whitespace-pre[^"]*"[^>]*>([^<]*)<\/span>/)

    const price = parsePrice(priceMatch?.[1])
    if (price === null) continue

    offers.push({
      id: `sbazar-${id}`,
      portal: 'Sbazar',
      title: stripTags(titleMatch?.[1] ?? ''),
      price,
      location: stripTags(locationMatch?.[1] ?? ''),
      category: '',
      url: `https://www.sbazar.cz${hrefMatch[1]}`,
      query,
    })
  }
  return offers
}

// ---------- Aukro ----------
function parseAukro(html, query) {
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

      const category = String(item?.offers?.category ?? '')
      offers.push({
        id: `aukro-${item?.sku ?? url.split('-').pop()}`,
        portal: 'Aukro',
        title: stripTags(title),
        price,
        location: category.split('/').filter(Boolean).pop() ?? '',
        category: category.split('/').filter(Boolean).pop() ?? '',
        url,
        query,
      })
    }
  }
  return offers
}

// ---------- srovnatelné nabídky ----------
// Musí sedět všechny tokeny s číslem (model, kapacita) a aspoň jedno slovo názvu —
// jinak se do trhu připlete "iPhone 13 obal" nebo úplně jiný model.
function isComparable(offer, tokens, config) {
  if (!offer.title || !offer.price) return false
  if (offer.price < Number(config.minPriceCzk ?? 100)) return false

  const title = normalize(offer.title)
  const compact = title.replace(/\s+/g, '')
  // jedna číslice jako podřetězec by sedla na cokoli ("500GB" obsahuje 5) — musí stát samostatně nebo za písmeny (ps5)
  const hit = (token) =>
    token.length < 2
      ? new RegExp(`(^|[a-z ])${token}( |$)`).test(title)
      : hasWord(title, token) || compact.includes(token)

  const digits = tokens.filter((t) => /\d/.test(t))
  const words = tokens.filter((t) => !/\d/.test(t))
  if (digits.length && !digits.every(hit)) return false
  if (words.length && !words.some(hit)) return false

  const excluded = (config.excludeKeywords ?? [])
    .map(normalize)
    .filter((word) => word && !tokens.includes(word))
  if (excluded.some((word) => hasWord(title, word) || compact.includes(word))) return false

  return true
}

// ---------- inzerát ----------
// "Prodám iPhone 13" → "iPhone 13": sloveso z popisu do titulku inzerátu nepatří.
function cleanTitle(raw) {
  return String(raw)
    .replace(/^\s*(prod[áa]m|prod[áa]v[áa]m|nab[íi]z[íi]m|nab[íi]z[íi]me|na prodej)\s+/i, '')
    .replace(/[\s.,;:!]+$/, '')
    .trim()
}

function buildListing(item, conditionLabel, prices, config, userPrice = null) {
  const firstLine = String(item).split(/\r?\n/)[0].trim()
  const parts = firstLine.split(',')
  const title = truncate(cleanTitle(parts[0]), Number(config.listingTitleMaxChars ?? 60))
  const details = [parts.slice(1).join(',').trim(), ...String(item).split(/\r?\n/).slice(1)]
    .map((s) => s.trim())
    .filter(Boolean)

  const lines = [`Prodám ${title}.`]
  if (details.length) lines.push('', details.join('\n'))

  lines.push('', `Stav: ${conditionLabel}.`)
  const price = userPrice ?? prices?.recommended ?? null
  const negotiable = config.listing?.negotiable !== false
  lines.push(price ? `Cena: ${formatCzk(price)}${negotiable ? ' (dohodou)' : ''}.` : 'Cena: doplň.')

  const location = String(config.listing?.location ?? '').trim()
  const handover = location ? `Osobní předání ${location}.` : 'Osobní předání po dohodě.'
  const delivery = config.listing?.shipping === false ? [] : ['Posílám i poštou / Zásilkovnou po platbě předem.']
  lines.push('', [handover, ...delivery].join('\n'))

  return { title, body: lines.join('\n'), price }
}

// ---------- zpráva do UI chatu ----------
function buildChatMessage(item, conditionLabel, prices, listing, reportPath, errors, userPrice = null) {
  const head = `🏷️ Stěpán — ocenění a inzerát`
  const lines = [head, truncate(String(item).split(/\r?\n/)[0], 90)]

  if (prices) {
    lines.push(
      '',
      `Trh: ${prices.count} srovnatelných nabídek · medián ${formatCzk(prices.median)} (${formatCzk(prices.min)}–${formatCzk(prices.max)})`,
      // prices.count je po odstranění extrémů — to je číslo, ze kterého cena opravdu vzešla
      `Doporučená cena: ${formatCzk(prices.recommended)} · rychle ${formatCzk(prices.quick)} · když počkáš ${formatCzk(prices.patient)}`,
    )
    if (prices.lowConfidence) lines.push('⚠️ Málo srovnatelných nabídek — cenu ber s rezervou.')
    if (userPrice) {
      const diff = Math.round(((userPrice - prices.median) / prices.median) * 100)
      const note = diff > 15 ? 'nad trhem, počítej s dlouhým prodejem' : diff < -20 ? 'hluboko pod trhem, zvaž víc' : 'sedí s trhem'
      lines.push(`Tvoje cena: ${formatCzk(userPrice)} (${diff > 0 ? '+' : ''}${diff} % vs. medián) — ${note}.`)
    }
  } else {
    lines.push('', userPrice
      ? `Na trhu jsem nenašel srovnatelné nabídky — dávám tvoji cenu ${formatCzk(userPrice)} bez srovnání.`
      : 'Na trhu jsem nenašel srovnatelné nabídky — cenu budeš muset doplnit ručně.')
  }

  lines.push('', `Inzerát — ${listing.title}`, listing.body)
  if (errors.length) lines.push('', `Poznámka: ${errors.join('; ')}`)
  if (reportPath) lines.push('', `Report: ${reportPath}`)

  return lines.join('\n').trim()
}

// ---------- report ----------
async function writeReport(item, condition, tokens, query, comparables, prices, listing, errors, startedAt, config) {
  const path = join(__dirname, `inzerat_${nowStamp(startedAt)}.md`)
  const lines = [
    `# Stěpán — ocenění a inzerát (${czechDate(startedAt)})`,
    '',
    '## Věc',
    '',
    `- **Popis:** ${String(item).replace(/\r?\n/g, ' ')}`,
    `- **Stav:** ${condition.label}`,
    `- **Dotaz na trh:** ${query || '—'}`,
    `- **Tokeny:** ${tokens.join(', ') || '—'}`,
    `- **Srovnatelných nabídek:** ${comparables.length}`,
    '',
    '## Cena',
    '',
  ]

  if (prices) {
    lines.push(
      `- **Medián trhu:** ${formatCzk(prices.median)} (${prices.count} nabídek)`,
      `- **Rozsah:** ${formatCzk(prices.min)} – ${formatCzk(prices.max)} (25.–75. percentil ${formatCzk(prices.p25)} – ${formatCzk(prices.p75)})`,
      `- **Doporučená cena:** ${formatCzk(prices.recommended)} (koeficient stavu ${condition.factor})`,
      `- **Rychlý prodej:** ${formatCzk(prices.quick)} · **když počkáš:** ${formatCzk(prices.patient)}`,
    )
    if (prices.lowConfidence) {
      lines.push('', `> ⚠️ Méně než ${Number(config.minComparableCount ?? 3)} srovnatelných nabídek (našel jsem ${prices.count}) — cena je jen orientační.`)
    }
  } else {
    lines.push('_Žádné srovnatelné nabídky — cenu doplň ručně._')
  }

  lines.push('', '## Inzerát', '', '```text', listing.body, '```', '')

  if (comparables.length) {
    lines.push('## Srovnatelné nabídky', '', '| # | Portál | Název | Cena | Odkaz |', '|---|---|---|---|---|')
    comparables.slice(0, 40).forEach((o, i) => {
      lines.push(`| ${i + 1} | ${o.portal} | ${o.title.replace(/\|/g, '\\|')} | ${formatCzk(o.price)} | ${o.url} |`)
    })
    lines.push('')
  }

  if (errors.length) {
    lines.push('## Chyby portálů', '', ...errors.map((e) => `- ${e}`), '')
  }

  await writeFile(path, lines.join('\n'), 'utf8')
  return path
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
}

async function saveState(state) {
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf8')

  const audit = await readJson(AUDIT_PATH, [])
  audit.push({
    timestamp: new Date().toISOString(),
    action: 'item-appraisal',
    item: state.item,
    condition: state.condition,
    comparables: state.comparableCount,
    recommended: state.price?.recommended ?? null,
    report: state.lastReport,
    errors: state.lastErrors,
  })
  await writeFile(AUDIT_PATH, JSON.stringify(audit.slice(-200), null, 2), 'utf8')

  const memory = await readJson(MEMORY_PATH, [])
  memory.push({
    ts: new Date().toISOString(),
    summary: `${state.item} → ${state.price ? formatCzk(state.price.recommended) : 'bez ceny'}`,
    comparables: state.comparableCount,
  })
  await writeFile(MEMORY_PATH, JSON.stringify(memory.slice(-50), null, 2), 'utf8')
}

async function takeInboxPhotos(startedAt) {
  const inbox = join(__dirname, 'fotky', 'inbox')
  const files = await readdir(inbox).catch(() => [])
  if (!files.length) return ''
  const target = join(__dirname, 'fotky', nowStamp(startedAt))
  await mkdir(join(__dirname, 'fotky'), { recursive: true })
  await rename(inbox, target)
  return target
}

// ---------- main ----------
function argValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function main() {
  const startedAt = new Date()
  const item = String(process.env.STEPAN_ITEM ?? argValue('--item') ?? '').trim()
  const requestedCondition = String(process.env.STEPAN_CONDITION ?? argValue('--condition') ?? '').trim()
  const rawPrice = String(process.env.STEPAN_PRICE ?? argValue('--price') ?? argValue('--cena') ?? '').replace(/\D/g, '')
  const userPrice = rawPrice ? Number(rawPrice) : null
  let photos = String(process.env.STEPAN_PHOTOS || argValue('--fotky') || '').trim()
  const postToSbazar = /^(1|true|ano)$/i.test(String(process.env.STEPAN_POST ?? '')) || process.argv.includes('--vlozit')
  // Fotky poslané přes Telegram čekají v fotky/inbox — při vkládání si je inzerát vezme a zásobník se vyprázdní
  if (postToSbazar && !photos) photos = await takeInboxPhotos(startedAt)

  if (!item) {
    console.error('Použití: node run.mjs --item "co prodáváš" [--cena 6000] [--fotky <složka>] [--vlozit] [--condition novy|jako-novy|velmi-dobry|dobry|opotrebovany|na-dily]')
    process.exit(1)
  }

  const config = await readJson(CONFIG_PATH, null)
  if (!config) {
    console.error(`❌ Nepodařilo se načíst ${CONFIG_PATH}`)
    process.exit(1)
  }

  const condition = resolveCondition(config, requestedCondition, item)
  const tokens = buildQueryTokens(item, config)
  const maxTokens = Math.max(1, Number(config.maxQueryTokens ?? 4))
  const timeoutMs = Number(config.requestTimeoutMs ?? 20000)
  const portals = config.portals ?? ['sbazar', 'aukro']

  if (!tokens.length) {
    console.error('❌ Z popisu se nepodařilo určit, co je to za věc. Napiš aspoň název/model.')
    process.exit(1)
  }

  // dotaz zkoušíme od nejkonkrétnějšího; když je málo srovnatelných, zobecníme
  const variants = []
  for (const size of [maxTokens, Math.min(maxTokens, 3), 2]) {
    const query = tokens.slice(0, Math.max(1, size)).join(' ')
    if (query && !variants.includes(query)) variants.push(query)
  }

  console.log(`[Stěpán] "${item}" · stav ${condition.label} · dotazy: ${variants.join(' → ')}`)

  const errors = []
  const seen = new Map()
  let query = variants[0]
  let comparables = []
  const minComparable = Number(config.minComparableCount ?? 3)

  for (const variant of variants) {
    query = variant
    for (const portal of portals) {
      const url =
        portal === 'sbazar'
          ? `https://www.sbazar.cz/hledej/${encodeURIComponent(variant)}`
          : `https://aukro.cz/vyhledavani?text=${encodeURIComponent(variant)}`
      try {
        const html = await fetchHtml(url, timeoutMs)
        const offers = portal === 'sbazar' ? parseSbazar(html, variant) : parseAukro(html, variant)
        for (const offer of offers) if (!seen.has(offer.url)) seen.set(offer.url, offer)
        console.log(`[${portal}] "${variant}" → ${offers.length} nabídek`)
      } catch (err) {
        if (portal === 'aukro' && /HTTP 404/.test(String(err?.message))) {
          console.log(`[Aukro] "${variant}" → dotaz neexistuje, přeskakuji`)
        } else {
          errors.push(`${portal} "${variant}": ${err?.message ?? err}`)
          console.warn(`[${portal}] "${variant}" selhal: ${err?.message ?? err}`)
        }
      }
      await sleep(400)
    }

    comparables = [...seen.values()]
      .filter((offer) => isComparable(offer, tokens, config))
      .sort((a, b) => a.price - b.price)
    console.log(`[Stěpán] "${variant}" → ${comparables.length} srovnatelných`)
    if (comparables.length >= minComparable) break
  }

  const prices = priceStats(comparables.map((o) => o.price), { ...config, __factor: condition.factor })
  const listing = buildListing(item, condition.label, prices, config, userPrice)
  const reportPath = await writeReport(item, condition, tokens, query, comparables, prices, listing, errors, startedAt, config)

  // nejčastější kategorie z Aukra řekne, co to vlastně je
  const categoryCounts = new Map()
  for (const offer of comparables) {
    if (!offer.category) continue
    categoryCounts.set(offer.category, (categoryCounts.get(offer.category) ?? 0) + 1)
  }
  const detectedCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''

  let chatText = buildChatMessage(item, condition.label, prices, listing, reportPath, errors, userPrice)
  if (postToSbazar) chatText += '\n\n📝 Otevírám Sbazar a předvyplňuju inzerát (nezveřejním ho, klikneš sám).'
  const state = {
    lastRun: new Date().toISOString(),
    item,
    condition: condition.id,
    conditionLabel: condition.label,
    query,
    detectedCategory,
    comparableCount: comparables.length,
    price: prices,
    listing,
    userPrice,
    photos,
    comparables: comparables.slice(0, 25).map((o) => ({
      title: o.title,
      price: o.price,
      portal: o.portal,
      location: o.location,
      url: o.url,
    })),
    lastReport: reportPath,
    lastChatText: chatText,
    lastErrors: errors,
  }
  await saveState(state)

  // Sbazar běží v Edge odděleně — okno zůstane otevřené pro kontrolu, tenhle proces skončí hned.
  if (postToSbazar) {
    const child = spawn(process.execPath, [join(__dirname, 'sbazar-post.mjs')], {
      cwd: __dirname,
      env: { ...process.env, STEPAN_PHOTOS: photos },
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
    console.log('[Stěpán] Sbazar: předvyplňování spuštěno v Edge')
  }

  console.log('\n--- OCENĚNÍ ---')
  if (prices) {
    console.log(`srovnatelných: ${prices.count} · medián ${formatCzk(prices.median)} (${formatCzk(prices.min)}–${formatCzk(prices.max)})`)
    console.log(
      `doporučená ${formatCzk(prices.recommended)} · rychle ${formatCzk(prices.quick)} · když počkáš ${formatCzk(prices.patient)}`,
    )
  } else {
    console.log('srovnatelné nabídky nenalezeny — cena chybí')
  }
  if (detectedCategory) console.log(`kategorie trhu: ${detectedCategory}`)
  console.log('\n--- INZERÁT ---')
  console.log(`${listing.title}\n\n${listing.body}`)
  console.log(`\n[Stěpán] hotovo · report ${reportPath}`)
  console.log(
    JSON.stringify({
      ok: true,
      item,
      query,
      condition: condition.id,
      comparables: comparables.length,
      recommended: prices?.recommended ?? null,
      report: reportPath,
    }),
  )
}

main().catch((err) => {
  console.error(`❌ Stěpán spadl: ${err?.stack ?? err}`)
  process.exit(1)
})
