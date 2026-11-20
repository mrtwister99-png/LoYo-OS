#!/usr/bin/env node
// data/capabilities/agents/lopatinka/run.mjs
// Lopatinka — hledač výhodné elektroniky na Sbazaru a Aukru.
// Bez závislostí: stačí Node 20+ (fetch + ESM), takže běží lokálně i v cloudu (cron / GitHub Actions).
//
// Použití:
//   node run.mjs               → najde 3 nabídky a pošle je do Telegramu (s 👍/👎 tlačítky)
//   node run.mjs --dry-run     → jen vypíše zprávu a zapíše report, Telegram neposílá
//
// ENV:
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID  (povinné pro ostrý běh)
//   LOPATINKA_BUDGET, LOPATINKA_PICK_COUNT (volitelné přepsání config.json)
//   LOPATINKA_DRY_RUN=1                    (totéž jako --dry-run)
//
// Hlídané dotazy (watchlist.json) se prohledávají navíc k dotazům z configu.
// 👎 z Telegramu (feedback.json) a IGNOROVAT z UI chatu (decisions.json) se už neposílají.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { priceStats } from '../../../lib/pricing.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../../../..')
const DATA_DIR = process.env.LOYO_DATA_DIR ? resolve(process.env.LOYO_DATA_DIR) : join(PROJECT_ROOT, 'data')
const REPORTS_DIR = join(DATA_DIR, 'reports')

const CONFIG_PATH = join(__dirname, 'config.json')
const STATE_PATH = join(__dirname, 'state.json')
const AUDIT_PATH = join(__dirname, 'audit.json')
const MEMORY_PATH = join(__dirname, 'memory.json')
const WATCHLIST_PATH = join(__dirname, 'watchlist.json')
const FEEDBACK_PATH = join(__dirname, 'feedback.json')
const DECISIONS_PATH = join(__dirname, 'decisions.json')

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- ENV ----------
// Lokální .env (projekt root) — v cloudu se berou přímo ENV proměnné a ty mají přednost.
async function loadDotEnv() {
  const envPath = join(PROJECT_ROOT, '.env')
  if (!existsSync(envPath)) return
  const raw = await readFile(envPath, 'utf8').catch(() => '')
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let value = m[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(m[1] in process.env)) process.env[m[1]] = value
  }
}

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

// bez diakritiky, malá písmena, jen slova
function normalize(input) {
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
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

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// cenové pásmo z configu — nikdy výš než rozpočet
function preferredBand(config, budget) {
  const min = Number(config.preferredPriceCzk?.min ?? 0)
  const max = Math.min(Number(config.preferredPriceCzk?.max ?? budget), budget)
  return { min, max, label: `${formatCzk(min)}–${formatCzk(max)}` }
}

// jediné místo, kde se tiskne sleva — nabídka nad mediánem je dražší, ne "výhodná"
function discountText(offer, { withMedian = true } = {}) {
  const discount = Number(offer.discount)
  const median = formatCzk(offer.median)
  if (!Number.isFinite(discount) || discount === 0) {
    return withMedian ? `na úrovni mediánu ${median}` : 'na mediánu'
  }
  if (discount > 0) return withMedian ? `−${discount} % vs. medián ${median}` : `−${discount} %`
  return withMedian ? `⚠️ +${Math.abs(discount)} % nad mediánem ${median}` : `+${Math.abs(discount)} % nad mediánem`
}

// Orientace, kolik na nabídce zbyde po přeprodeji: medián × 0,95 (prodáváš pod trhem),
// mínus riziko a doprava. Není to slib — je to hrubý filtr „má to vůbec smysl“.
function estimateProfit(offer, config) {
  const p = config.profit ?? {}
  if (p.enabled === false) return null
  const resaleFactor = Number(p.resaleFactor ?? 0.95)
  const riskPercent = Number(p.riskPercent ?? 10)
  const shippingCzk = Number(p.shippingCzk ?? 150)
  const resale = Math.round((offer.median * resaleFactor) / 10) * 10
  const profit = Math.round((resale * (1 - riskPercent / 100) - shippingCzk - offer.price) / 10) * 10
  return {
    resale,
    shipping: shippingCzk,
    profit,
    marginPercent: offer.price > 0 ? Math.round((profit / offer.price) * 100) : 0,
  }
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
        url,
        query,
      })
    }
  }
  return offers
}

// ---------- filtrování a skórování ----------
// celoslovní shoda — "ram" nesmí chytit "program"
function hasWord(text, phrase) {
  return ` ${text} `.includes(` ${phrase} `)
}

function isRelevant(offer, config, budget) {
  if (!offer.title || offer.price === null) return false
  if (offer.price < config.minPriceCzk || offer.price > budget) return false

  const title = normalize(offer.title)
  const query = normalize(offer.query)
  const tokens = query.split(' ').filter((w) => w.length >= 3)
  if (tokens.length && !tokens.some((token) => hasWord(title, token))) return false

  // konkrétní název: aspoň 2 slova a ideálně model/číslo — pryč s "notebooky" a "Grafická karta"
  const titleTokens = title.split(' ').filter(Boolean)
  const minTokens = config.minTitleTokens ?? 2
  if (titleTokens.length < minTokens) return false
  if (!/\d/.test(title) && titleTokens.length < 3) return false

  const excluded = (config.excludeKeywords ?? [])
    .map(normalize)
    .filter((word) => word && !hasWord(query, word))
  if (excluded.some((word) => hasWord(title, word))) return false

  return true
}

function buildCandidates(rawOffers, config, budget, { queries = config.queries, skipUrls = new Set() } = {}) {
  const byQuery = new Map()

  for (const query of queries) {
    const relevant = rawOffers.filter(
      (o) => o.query === query && !skipUrls.has(o.url) && isRelevant(o, config, budget),
    )

    // Medián trhu pro dotaz: přednostně ze Sbazaru, kde se prodává za skutečnou cenu.
    // Aukro je plné aukcí, jejichž "cena" je jen počáteční příhoz (iPhone 13 za 530 Kč),
    // a takový medián by rozbil slevy i zisk. Aukro se použije jen jako záchrana.
    const noAukro = relevant.filter((o) => o.portal !== 'Aukro')
    const trusted = noAukro.length >= 3 ? noAukro : relevant
    const referencePrices = trusted.length >= 3
      ? trusted.map((o) => o.price)
      : rawOffers.filter((o) => o.query === query && o.price && !skipUrls.has(o.url)).map((o) => o.price)
    const stats = priceStats(referencePrices, { ...config, __factor: 1 })
    const marketMedian = stats?.median ?? 0

    const ratio = config.minPriceRatioOfMedian ?? 0.25
    const maxDiscount = Number(config.maxDiscountPercent ?? 60)
    const candidates = relevant
      .filter((offer) => !marketMedian || offer.price >= marketMedian * ratio)
      .map((offer) => {
        const discount = marketMedian > 0 ? Math.round((1 - offer.price / marketMedian) * 100) : 0
        return { ...offer, median: marketMedian, discount, sample: stats?.count ?? 0 }
      })
      // víc než 60 % pod trhem nebývá výhodná koupě, ale aukce, vada nebo podvod
      .filter((offer) => offer.discount <= maxDiscount)

    candidates.sort((a, b) => b.discount - a.discount || a.price - b.price)
    byQuery.set(query, candidates)
  }

  return byQuery
}

// Výběr: hlavní tipy přednostně z pásma 2 500–3 500 Kč, bonusy navíc jen mimo pásmo.
function pickOffers(byQuery, config, pickCount, budget) {
  const band = preferredBand(config, budget)
  const minDiscount = Number(config.minDiscountPercent ?? 0)
  const bonusCount = Math.max(0, Number(config.bonusPickCount ?? 0))
  const inBand = (o) => o.price >= band.min && o.price <= band.max

  const queues = [...byQuery.values()].map((list) => list.slice())
  const used = new Set()
  const picks = []

  // round-robin mezi dotazy, aby jeden dotaz nezaplnil celý seznam
  const take = (predicate, limit, slot) => {
    let added = true
    while (picks.length < limit && added) {
      added = false
      for (const queue of queues) {
        const index = queue.findIndex((o) => !used.has(o.url) && predicate(o))
        if (index === -1) continue
        const [offer] = queue.splice(index, 1)
        used.add(offer.url)
        picks.push({ ...offer, inBand: inBand(offer), slot })
        added = true
        if (picks.length >= limit) break
      }
    }
  }

  // priority se berou popořadě, dokud je co brát
  const fill = (rules, limit, slot) => {
    for (const rule of rules) take(rule, limit, slot)
  }

  // hlavní tipy: v pásmu se slevou ≥ minDiscount → jakákoli kladná sleva → cokoli
  // v pásmu (i nad mediánem); mimo pásmo jen jako krajní záchrana, když pásmo nic nemá
  fill(
    [
      (o) => inBand(o) && o.discount >= minDiscount,
      (o) => inBand(o) && o.discount > 0,
      (o) => inBand(o),
      (o) => o.discount >= minDiscount,
      (o) => o.discount > 0,
      () => true,
    ],
    pickCount,
    'main',
  )

  // bonusy navíc: vždy jen mimo pásmo, aby hlavní tipy zůstaly za větší částky
  if (bonusCount > 0) {
    fill(
      [
        (o) => !inBand(o) && o.discount >= minDiscount,
        (o) => !inBand(o) && o.discount > 0,
        (o) => !inBand(o),
      ],
      pickCount + bonusCount,
      'bonus',
    )
  }

  // hlavní tipy první (od největší slevy), bonusy za nimi
  picks.sort(
    (a, b) =>
      Number(b.slot === 'main') - Number(a.slot === 'main') || b.discount - a.discount || a.price - b.price,
  )
  return picks
}

// ---------- zpráva pro Telegram ----------
function buildTelegramParts(picks, config, budget, errors) {
  const band = preferredBand(config, budget)

  const header = picks.length
    ? [
        `<b>🛒 Lopatinka — ${picks.length} ${picks.length === 1 ? 'nabídka' : picks.length < 5 ? 'nabídky' : 'nabídek'} do ${formatCzk(budget)}</b>`,
        `<i>${czechDate()} · Sbazar + Aukro · priorita ${band.label}</i>`,
      ].join('\n')
    : [
        `<b>🛒 Lopatinka — dnes nic do ${formatCzk(budget)}</b>`,
        `<i>${czechDate()} · Sbazar + Aukro · priorita ${band.label}</i>`,
      ].join('\n')

  const items = picks.map((offer, index) => {
    const place = offer.location ? ` · ${escapeHtml(offer.location)}` : ''
    const tags = []
    if (offer.source === 'watch') {
      tags.push(`🔔 ${escapeHtml(offer.watch?.label ?? 'hlídaný dotaz')}${offer.watch?.new ? ' · NOVÉ' : ''}`)
    }
    if (offer.slot === 'bonus') tags.push('💡 bonus mimo pásmo')
    else if (!offer.inBand) tags.push('💡 mimo pásmo')

    const lines = [
      `<b>${index + 1}) ${escapeHtml(offer.title)}</b>`,
      `💸 <b>${formatCzk(offer.price)}</b> · ${discountText(offer)}`,
    ]
    if (offer.profit) lines.push(`💰 zisk ~${formatCzk(offer.profit.profit)} (${offer.profit.marginPercent} %) po dopravě a riziku`)
    lines.push(`🏷 ${offer.portal}${place}${tags.length ? ' · ' + tags.join(' · ') : ''}`)
    lines.push(offer.url)

    const keyboard = [[
      { text: '👍 Má smysl', callback_data: `fb:up:${index}` },
      { text: '👎 Neposílat', callback_data: `fb:down:${index}` },
    ]]
    if (/^https?:/.test(offer.url)) keyboard.push([{ text: '🔗 Otevřít nabídku', url: offer.url }])

    return { text: lines.join('\n'), keyboard }
  })

  const footer = []
  const bonuses = picks.filter((o) => o.slot === 'bonus').length
  const watched = picks.filter((o) => o.source === 'watch').length
  const main = picks.length - bonuses - watched
  if (bonuses) {
    footer.push(`<i>${main}× hlavní tip v pásmu ${band.label}, ${bonuses}× bonus mimo pásmo.</i>`)
  }
  if (watched) footer.push(`<i>🔔 ${watched}× z hlídaných dotazů.</i>`)
  const aboveMedian = picks.filter((o) => o.discount < 0)
  if (aboveMedian.length) {
    footer.push(
      `<i>⚠️ ${aboveMedian.length}× nabídka nad mediánem trhu — v pásmu nebylo nic výhodnějšího, ber ji jako poslední záchranu.</i>`,
    )
  }
  if (errors.length) footer.push(`<i>Poznámka: ${errors.map(escapeHtml).join('; ')}</i>`)
  footer.push('<i>Lopatinka · LOYO OS</i>')

  return { header, items, footer: footer.join('\n') }
}

function buildTelegramText(parts) {
  return [parts.header, ...parts.items.map((i) => i.text), parts.footer].filter(Boolean).join('\n\n')
}

// Souhrn do UI chatu — Chat.tsx zobrazuje prostý text, takže bez HTML a se stejnými
// tipy jako Telegram. Text se ukládá do state.json, aby se formát neopsoval v API.
function buildChatMessage(picks, dryRun, reportPath) {
  if (!picks.length) {
    return `🛒 Lopatinka proběhla${dryRun ? ' (dry-run)' : ''}, ale nic rozumného do rozpočtu nenašla.`
  }
  const line = (offer, index) => {
    const profit = offer.profit ? ` · zisk ~${formatCzk(offer.profit.profit)}` : ''
    const watch = offer.source === 'watch' ? `\n🔔 ${offer.watch?.label ?? 'hlídaný dotaz'}${offer.watch?.new ? ' · NOVÉ' : ''}` : ''
    return `${index + 1}) ${offer.title} — ${formatCzk(offer.price)} · ${discountText(offer)}${profit}\n${offer.url}${watch}`
  }
  const main = picks.filter((o) => o.source !== 'watch' && o.slot !== 'bonus')
  const bonus = picks.filter((o) => o.source !== 'watch' && o.slot === 'bonus')
  const watched = picks.filter((o) => o.source === 'watch')
  const parts = [
    `🛒 Lopatinka — ${picks.length} nabídek${dryRun ? ' (dry-run, do Telegramu neodesláno)' : ' → odesláno do Telegramu'}`,
    main.map(line).join('\n\n'),
  ]
  if (bonus.length) {
    parts.push(['💡 Bonusy mimo pásmo:', ...bonus.map((o, i) => line(o, main.length + i))].join('\n\n'))
  }
  if (watched.length) {
    parts.push(
      ['🔔 Hlídané dotazy:', ...watched.map((o, i) => line(o, main.length + bonus.length + i))].join('\n\n'),
    )
  }
  if (reportPath) parts.push(`Report: ${reportPath}`)
  return parts.filter(Boolean).join('\n\n')
}

async function sendTelegramParts(parts, config) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    throw new Error('Chybí TELEGRAM_BOT_TOKEN nebo TELEGRAM_CHAT_ID (ENV / .env / GitHub secrets).')
  }

  const send = async (text, keyboard) => {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: config.telegram?.parseMode ?? 'HTML',
        disable_web_page_preview: config.telegram?.disablePreview ?? true,
        ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
      }),
      signal: AbortSignal.timeout(20000),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || data?.ok === false) {
      throw new Error(`Telegram odmítl zprávu: ${data?.description ?? `HTTP ${res.status}`}`)
    }
  }

  await send(parts.header)
  for (const item of parts.items) await send(item.text, item.keyboard)
  if (parts.footer) await send(parts.footer)
}

// ---------- report + stav ----------
async function writeReport(picks, byQuery, errors, budget, startedAt, config, watchlist) {
  await mkdir(REPORTS_DIR, { recursive: true })
  const stamp = nowStamp(startedAt)
  const path = join(__dirname, `nabidky_${stamp}.md`)

  const band = preferredBand(config, budget)
  const lines = [
    `# Lopatinka — hledání ${czechDate(startedAt)}`,
    '',
    `- **Rozpočet:** ${formatCzk(budget)} / kus`,
    `- **Portály:** Sbazar, Aukro`,
    `- **Dotazy:** ${[...byQuery.keys()].join(', ')}`,
    `- **Hlídané dotazy:** ${(watchlist ?? []).filter((w) => w.active !== false).length}`,
    `- **Nalezeno kandidátů:** ${[...byQuery.values()].reduce((sum, list) => sum + list.length, 0)}`,
    '',
    '## TOP nabídky',
    '',
  ]

  if (picks.length) {
    lines.push('| # | Portál | Název | Cena | Typ | Medián | Sleva | Zisk | Odkaz |')
    lines.push('|---|---|---|---|---|---|---|---|---|')
    picks.forEach((offer, index) => {
      const title = offer.title.replace(/\|/g, '\\|')
      const type = offer.source === 'watch' ? 'hlídané' : offer.slot === 'bonus' ? 'bonus' : offer.inBand ? 'pásmo' : 'pásmo · mimo'
      const profit = offer.profit ? formatCzk(offer.profit.profit) : '—'
      lines.push(
        `| ${index + 1} | ${offer.portal} | ${title} | ${formatCzk(offer.price)} | ${type} | ${formatCzk(offer.median)} | ${discountText(offer, { withMedian: false })} | ${profit} | ${offer.url} |`,
      )
    })

    const mainPicks = picks.filter((o) => o.source !== 'watch' && o.slot !== 'bonus')
    const bonusPicks = picks.filter((o) => o.source !== 'watch' && o.slot === 'bonus')
    lines.push(
      '',
      `> Hlavní tipy (${mainPicks.length}) drží pásmo ${band.label}` +
        (bonusPicks.length
          ? `, ${bonusPicks.length}× bonus mimo pásmo: ${bonusPicks.map((o) => `${o.title} (${formatCzk(o.price)})`).join(', ')}.`
          : '.'),
    )

    const above = picks.filter((o) => o.discount < 0)
    if (above.length) {
      lines.push(
        '',
        `> ⚠️ ${above.length}× nabídka nad mediánem trhu (${above.map((o) => o.title).join(', ')}) — do tipů se dostala jen proto, že v pásmu nebylo nic výhodnějšího.`,
      )
    }
  } else {
    lines.push('_Žádná nabídka v rozpočtu._')
  }

  const all = [...byQuery.entries()].flatMap(([query, list]) => list.map((o) => ({ ...o, query })))
  if (all.length) {
    lines.push('', '## Všichni kandidáti', '')
    lines.push('| Dotaz | Portál | Název | Cena | Sleva | Odkaz |')
    lines.push('|---|---|---|---|---|---|')
    for (const offer of all) {
      const title = offer.title.replace(/\|/g, '\\|')
      lines.push(
        `| ${offer.query} | ${offer.portal} | ${title} | ${formatCzk(offer.price)} | ${discountText(offer, { withMedian: false })} | ${offer.url} |`,
      )
    }
  }

  const activeWatch = (watchlist ?? []).filter((w) => w.active !== false)
  if (activeWatch.length) {
    lines.push('', '## Hlídané dotazy', '')
    for (const w of activeWatch) {
      lines.push(
        `- **${w.query}**${w.maxPrice ? ` do ${formatCzk(w.maxPrice)}` : ''} — ${w.lastCount ?? 0} kandidátů${w.lastBest ? `, nejlepší ${w.lastBest.title} (${formatCzk(w.lastBest.price)})` : ''}`,
      )
    }
  }

  if (errors.length) {
    lines.push('', '## Chyby portálů', '')
    errors.forEach((e) => lines.push(`- ${e}`))
  }

  await writeFile(path, lines.join('\n') + '\n', 'utf8')
  return path
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
}

async function writeJson(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2), 'utf8')
}

async function loadWatchlist() {
  const data = await readJson(WATCHLIST_PATH, { items: [] })
  return Array.isArray(data?.items) ? data : { items: [] }
}

async function loadFeedback() {
  const data = await readJson(FEEDBACK_PATH, { ratings: [] })
  return Array.isArray(data?.ratings) ? data : { ratings: [] }
}

async function saveState(state) {
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf8')

  const audit = await readJson(AUDIT_PATH, [])
  audit.push({
    timestamp: new Date().toISOString(),
    action: 'bazar-scan',
    reasoning: `Sbazar + Aukro, rozpočet ${state.lastPicks.length ? 'dodržen' : 'bez nálezu'}`,
    confidence: state.lastPicks.length >= 3 ? 0.9 : 0.5,
    picks: state.lastPicks.length,
    watched: state.lastPicks.filter((p) => p.source === 'watch').length,
    report: state.lastReport,
    errors: state.lastErrors,
  })
  await writeFile(AUDIT_PATH, JSON.stringify(audit.slice(-200), null, 2), 'utf8')

  const memory = await readJson(MEMORY_PATH, [])
  memory.push({
    ts: new Date().toISOString(),
    summary: state.lastResult,
    picks: state.lastPicks.map((p) => `${p.title} (${p.price} Kč)`),
  })
  await writeFile(MEMORY_PATH, JSON.stringify(memory.slice(-50), null, 2), 'utf8')
}

// Projde jeden dotaz na všech portálech; chyby sbírá do errors, běh nezastaví.
async function scanQuery(query, { config, timeoutMs, errors }) {
  const offers = []
  const portals = config.portals ?? ['sbazar', 'aukro']

  for (const portal of portals) {
    if (portal === 'sbazar') {
      // Pozor: parametr price-to na Sbazaru způsobuje redirect loop — cenu filtrujeme lokálně.
      const url = `https://www.sbazar.cz/hledej/${encodeURIComponent(query)}`
      try {
        const html = await fetchHtml(url, timeoutMs)
        const parsed = parseSbazar(html, query)
        offers.push(...parsed)
        console.log(`[Sbazar] "${query}" → ${parsed.length} nabídek`)
      } catch (err) {
        errors.push(`Sbazar "${query}": ${err?.message ?? err}`)
        console.warn(`[Sbazar] "${query}" selhal: ${err?.message ?? err}`)
      }
      await sleep(400)
    }

    if (portal === 'aukro') {
      const url = `https://aukro.cz/vyhledavani?text=${encodeURIComponent(query)}`
      try {
        const html = await fetchHtml(url, timeoutMs)
        const parsed = parseAukro(html, query)
        offers.push(...parsed)
        console.log(`[Aukro] "${query}" → ${parsed.length} nabídek`)
      } catch (err) {
        // Aukro u neexistujícího dotazu vrací 404 — to není chyba, jen dotaz přeskočíme.
        if (/HTTP 404/.test(String(err?.message))) {
          console.log(`[Aukro] "${query}" → dotaz na Aukru neexistuje, přeskakuji`)
        } else {
          errors.push(`Aukro "${query}": ${err?.message ?? err}`)
          console.warn(`[Aukro] "${query}" selhal: ${err?.message ?? err}`)
        }
      }
      await sleep(400)
    }
  }

  return offers
}

// ---------- main ----------
async function main() {
  const dryRun = process.argv.includes('--dry-run') || process.env.LOPATINKA_DRY_RUN === '1'
  const startedAt = new Date()

  await loadDotEnv()

  const config = await readJson(CONFIG_PATH, null)
  if (!config) {
    console.error(`❌ Nepodařilo se načíst ${CONFIG_PATH}`)
    process.exit(1)
  }

  const budget = Number(process.env.LOPATINKA_BUDGET ?? config.budgetCzk ?? 3500)
  const pickCount = Math.max(1, Number(process.env.LOPATINKA_PICK_COUNT ?? config.pickCount ?? 3))
  const band = preferredBand(config, budget)
  const timeoutMs = Number(config.requestTimeoutMs ?? 20000)

  console.log(
    `[Lopatinka] pásmo ${band.label} · ${pickCount} tipů + ${Number(config.bonusPickCount ?? 0)} bonusů · rozpočet ${formatCzk(budget)}`,
  )

  // co uživatel odmítl (👎 v Telegramu nebo IGNOROVAT v chatu) se znovu neposílá
  const feedback = await loadFeedback()
  const decisions = await readJson(DECISIONS_PATH, { decisions: [] })
  const skipUrls = new Set()
  for (const rating of feedback.ratings ?? []) if (rating.verdict === 'down' && rating.url) skipUrls.add(rating.url)
  for (const d of decisions.decisions ?? []) if (d.action === 'ignored' && d.url) skipUrls.add(d.url)

  const errors = []
  const rawOffers = []
  for (const query of config.queries) {
    rawOffers.push(...await scanQuery(query, { config, timeoutMs, errors }))
  }

  const byQuery = buildCandidates(rawOffers, config, budget, { skipUrls })
  const picks = pickOffers(byQuery, config, pickCount, budget).map((offer) => ({
    ...offer,
    source: 'main',
    profit: estimateProfit(offer, config),
  }))

  // hlídané dotazy — každý má vlastní strop ceny a pamatuje si, co už viděl
  const watchlist = await loadWatchlist()
  const watchLimit = Math.max(1, Number(config.watch?.maxPicks ?? 2))
  const seenLimit = Math.max(10, Number(config.watch?.seenLimit ?? 60))
  const watchPicks = []
  const activeWatch = watchlist.items.filter((w) => w.active !== false)

  for (const item of activeWatch) {
    const maxPrice = Number(item.maxPrice ?? budget)
    const offers = await scanQuery(item.query, { config, timeoutMs, errors })
    const found = buildCandidates(offers, config, maxPrice, { queries: [item.query], skipUrls })
    const candidates = (found.get(item.query) ?? []).filter((o) => o.price <= maxPrice)
    const previousSeen = new Set(item.seen ?? [])
    const taken = new Set([...picks.map((p) => p.url), ...watchPicks.map((p) => p.url)])

    const chosen = candidates
      .filter((o) => !taken.has(o.url) && o.discount >= 0)
      .map((offer) => ({
        ...offer,
        source: 'watch',
        profit: estimateProfit(offer, config),
        watch: { id: item.id, label: item.label ?? item.query, new: !previousSeen.has(offer.url) },
      }))
      // do hlídaných tipů jde jen to, co má reálnou marži — jinak by chodily aukce a vady
      .filter((offer) => !offer.profit || offer.profit.profit > 0)
      .slice(0, watchLimit)
    watchPicks.push(...chosen)

    item.seen = [...new Set([...candidates.map((o) => o.url), ...(item.seen ?? [])])].slice(0, seenLimit)
    item.lastRun = new Date().toISOString()
    item.lastCount = candidates.length
    item.lastBest = chosen[0]
      ? { title: chosen[0].title, price: chosen[0].price, url: chosen[0].url }
      : null
  }

  if (activeWatch.length) await writeJson(WATCHLIST_PATH, watchlist)

  const picksAll = [...picks, ...watchPicks]
  const reportPath = await writeReport(picksAll, byQuery, errors, budget, startedAt, config, watchlist.items)
  const chatText = buildChatMessage(picksAll, dryRun, reportPath)
  const parts = buildTelegramParts(picksAll, config, budget, errors)
  const summary = picksAll.length
    ? `${picksAll.length} nabídky do ${formatCzk(budget)} → ${dryRun ? 'dry-run' : 'Telegram'}`
    : 'žádná nabídka v rozpočtu'

  const state = {
    lastRun: new Date().toISOString(),
    lastResult: summary,
    lastReport: reportPath,
    lastChatText: chatText,
    lastErrors: errors,
    lastPicks: picksAll.map((o) => ({
      title: o.title,
      price: o.price,
      median: o.median,
      discount: o.discount,
      inBand: o.inBand !== false,
      slot: o.slot ?? 'main',
      portal: o.portal,
      location: o.location ?? '',
      url: o.url,
      source: o.source ?? 'main',
      watchId: o.watch?.id ?? null,
      watchLabel: o.watch?.label ?? null,
      isNew: o.watch?.new ?? false,
      profit: o.profit?.profit ?? null,
      profitMargin: o.profit?.marginPercent ?? null,
    })),
    // struktura pro klikací kartu v UI chatu
    lastChatPicks: picksAll.map((o) => ({
      title: o.title,
      price: o.price,
      median: o.median,
      discount: o.discount,
      portal: o.portal,
      url: o.url,
      inBand: o.inBand !== false,
      slot: o.slot ?? 'main',
      source: o.source ?? 'main',
      isNew: o.watch?.new ?? false,
      watchLabel: o.watch?.label ?? null,
      profit: o.profit?.profit ?? null,
      profitMargin: o.profit?.marginPercent ?? null,
    })),
    feedback: {
      up: (feedback.ratings ?? []).filter((r) => r.verdict === 'up').length,
      down: (feedback.ratings ?? []).filter((r) => r.verdict === 'down').length,
      skipped: skipUrls.size,
    },
  }

  // Stav se ukládá PŘED odesláním: 👍/👎 tlačítka i /stav potřebují poslední tipy i tehdy,
  // když Telegram selže.
  await saveState(state)

  console.log('\n--- VYBRANÉ NABÍDKY ---')
  if (!picksAll.length) console.log('(nic)')
  picksAll.forEach((offer, index) => {
    const tag = offer.source === 'watch'
      ? ` · 🔔 ${offer.watch?.label ?? 'hlídané'}${offer.watch?.new ? ' NOVÉ' : ''}`
      : offer.slot === 'bonus'
        ? ' · bonus mimo pásmo'
        : offer.inBand
          ? ''
          : ' · mimo pásmo'
    const profit = offer.profit ? ` · zisk ~${formatCzk(offer.profit.profit)}` : ''
    console.log(
      `${index + 1}) ${offer.title} — ${formatCzk(offer.price)} · ${discountText(offer, { withMedian: false })}${profit} · ${offer.portal}${tag} · ${offer.url}`,
    )
  })
  if (activeWatch.length) console.log(`[Lopatinka] hlídané dotazy: ${activeWatch.length} · ${skipUrls.size} vyřazených nabídek`)

  if (dryRun) {
    console.log('\n--- TELEGRAM (dry-run) ---\n' + buildTelegramText(parts))
    console.log(`[Lopatinka] hotovo (dry-run) · report ${reportPath}`)
    console.log(JSON.stringify({ ok: true, dryRun: true, picks: picksAll.length, report: reportPath }))
    return
  }

  try {
    await sendTelegramParts(parts, config)
  } catch (err) {
    console.error(`❌ Telegram: ${err?.message ?? err}`)
    console.log(JSON.stringify({ ok: false, picks: picksAll.length, report: reportPath, error: String(err?.message ?? err) }))
    process.exit(2)
  }

  console.log(`[Lopatinka] hotovo · ${picksAll.length} nabídky odeslány do Telegramu · report ${reportPath}`)
  console.log(JSON.stringify({ ok: true, picks: picksAll.length, report: reportPath }))
}

main().catch((err) => {
  console.error(`❌ Lopatinka spadla: ${err?.stack ?? err}`)
  process.exit(1)
})
