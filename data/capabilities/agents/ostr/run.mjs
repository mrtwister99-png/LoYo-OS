#!/usr/bin/env node
// data/capabilities/agents/ostr/run.mjs
// Ostř — hlídač a kontrolor cen. Dva režimy, bez závislostí (Node 20+):
//
//   KONTROLA  — "je tahle cena v pořádku?"
//     node run.mjs --check "iPhone 13 128 GB" --price 9500
//     node run.mjs --check "<celý text inzerátu, cena se najde sama>"
//
//   HLÍDÁNÍ   — projde watchlist.json, porovná s minulým během, hlásí poklesy a cíle
//     node run.mjs --watch
//     node run.mjs --add "RTX 3060 12GB" --target 5000
//     node run.mjs --remove <id>
//
// ENV (používá API, ať se nemusí escapovat argumenty): OSTR_MODE (check|watch|add|remove),
//   OSTR_ITEM, OSTR_PRICE, OSTR_TARGET, OSTR_ID
//
// Výstup: report kontrola_*.md / hlidani_*.md, state.json (+ lastChatText), audit.json, history.json.

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { priceStats } from '../../../lib/pricing.mjs'
import { buildQueryTokens, formatCzk, normalize, hasWord, parsePrice, scanMarket } from '../../../lib/market.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const P = (f) => join(__dirname, f)

// ---------- soubory ----------
async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
}
const writeJson = (path, data) => writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf8')

function nowStamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`
}
const czechDate = (date = new Date()) =>
  new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Prague' }).format(date)

const pct = (a, b) => (b ? Math.round(((a - b) / b) * 1000) / 10 : 0)
const signed = (n) => `${n > 0 ? '+' : ''}${String(n).replace('.', ',')} %`
const md = (s) => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')

async function audit(entry) {
  const list = await readJson(P('audit.json'), [])
  list.push({ timestamp: new Date().toISOString(), ...entry })
  await writeJson(P('audit.json'), list.slice(-300))
}

async function saveState(patch) {
  const prev = await readJson(P('state.json'), {})
  const state = { ...prev, ...patch, lastRun: new Date().toISOString() }
  await writeJson(P('state.json'), state)
  return state
}

// ---------- vstup ----------
// Z inzerátu vytáhne cenu: "9 500 Kč", "9.500,-", "cena 9500"
function findPriceInText(text) {
  const m =
    String(text).match(/(\d[\d\s. ]{1,9})\s*(?:kč|kc|czk|,-)/i) ||
    String(text).match(/cen[aau]\s*:?\s*(\d[\d\s. ]{1,9})/i)
  return m ? parsePrice(m[1]) : null
}

// Titulek = první řádek / první segment před čárkou; z něj se staví dotaz na trh
function titleOf(text) {
  return String(text).split(/\r?\n/)[0].split(/[,;(]/)[0].replace(/\d[\d\s. ]*\s*(kč|kc|czk|,-)/gi, ' ')
    .replace(/^\s*(prod[áa]m|prod[áa]v[áa]m|nab[íi]z[íi]m|koup[íi]m|na prodej)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function redFlags(text, config) {
  const t = normalize(text)
  return [...new Set((config.redFlagKeywords ?? []).filter((w) => hasWord(t, normalize(w))))]
}

// ---------- verdikt ----------
// Pořadí je záměrné: podezřele levné má přednost před "výhodné" — příliš dobrá cena je varování, ne dárek.
function verdictFor(price, stats, config) {
  const v = config.verdict ?? {}
  const suspicious = stats.median * Number(v.suspiciousBelowMedian ?? 0.45)
  const bargain = stats[v.bargainAtOrBelow ?? 'p25']
  const fair = stats[v.fairAtOrBelow ?? 'p75']
  const diff = price - stats.median
  const diffPct = pct(price, stats.median)

  let id, emoji, label, advice
  if (price < suspicious) {
    id = 'suspicious'; emoji = '🚩'; label = 'Podezřele levné'
    advice = 'Pod polovinou trhu. Typicky podvod, replika, blokace (iCloud/IMEI) nebo díly. Jen osobně, zkontrolovat funkčnost, nikdy záloha předem.'
  } else if (price <= bargain) {
    id = 'bargain'; emoji = '🟢'; label = 'Výhodné'
    advice = 'V nejlevnější čtvrtině trhu. Když sedí stav, ber.'
  } else if (price <= fair) {
    id = 'fair'; emoji = '🟡'; label = 'Férové'
    advice = `Běžná tržní cena. Zkus nabídnout ${formatCzk(roundTo(bargain, config))}.`
  } else if (price <= stats.max) {
    id = 'overpriced'; emoji = '🟠'; label = 'Předražené'
    advice = `Dražší než 3/4 trhu. Férová protinabídka ${formatCzk(roundTo(stats.median, config))}, jinak hledej dál.`
  } else {
    id = 'top'; emoji = '🔴'; label = 'Nad celým trhem'
    advice = `Dražší než jakákoli srovnatelná nabídka (${formatCzk(stats.max)}). Nekupovat za tuhle cenu.`
  }
  return { id, emoji, label, advice, diff, diffPct, counterOffer: roundTo(Math.min(price, stats.p25 || stats.median), config) }
}

function roundTo(value, config) {
  const r = Math.max(1, Number(config.roundingCzk ?? 50))
  return Math.max(r, Math.round(value / r) * r)
}

// ---------- KONTROLA ----------
async function runCheck(config, text, explicitPrice) {
  const startedAt = new Date()
  const title = titleOf(text) || String(text).trim()
  const price = explicitPrice ?? findPriceInText(text)
  const tokens = buildQueryTokens(title, config.stopwords)
  if (!tokens.length) throw new UserError('Z textu nepoznám, o jakou věc jde. Napiš aspoň název a model.')

  console.log(`[Ostř] kontrola "${title}" · cena ${price ? formatCzk(price) : '—'}`)
  const market = await scanMarket(tokens, config, (m) => console.log(m))
  const stats = priceStats(market.comparables.map((o) => o.price), config)
  const flags = redFlags(text, config)
  const verdict = stats && price ? verdictFor(price, stats, config) : null
  // levná cena + varovná slova = učebnicový podvod; verdikt "výhodné" by tu byl nebezpečný
  if (verdict && flags.length && (verdict.id === 'bargain' || verdict.id === 'suspicious')) {
    verdict.advice = `POZOR: cena láká, ale text má varovná slova (${flags.join(', ')}). Přesně takhle vypadá podvod — jen osobně, nic předem. ${verdict.advice}`
    verdict.flagged = true
  }
  const suspiciousBelow = stats ? stats.median * Number(config.verdict?.suspiciousBelowMedian ?? 0.45) : 0
  const cheaper = price ? market.comparables.filter((o) => o.price < price).slice(0, 3) : market.comparables.slice(0, 3)

  // --- chat ---
  const lines = [`🔍 Ostř — kontrola ceny`, title]
  if (!stats) {
    lines.push('', 'Na Sbazaru ani Aukru nevidím nic srovnatelného — cenu neumím obhájit ani shodit. Zkus přesnější model.')
  } else {
    lines.push('', `Trh: ${stats.count} srovnatelných · medián ${formatCzk(stats.median)} · běžně ${formatCzk(stats.p25)}–${formatCzk(stats.p75)}`)
    if (verdict) {
      lines.push(
        `${verdict.flagged ? '🚩' : verdict.emoji} ${verdict.label}${verdict.flagged ? ' (ale s varováním)' : ''}: ${formatCzk(price)} (${signed(verdict.diffPct)} vs. medián)`,
        verdict.advice,
      )
    } else {
      lines.push('Cenu jsem v textu nenašel — pošli ji: `/ostr <věc> --cena 9500`.')
    }
    if (stats.lowConfidence) lines.push('⚠️ Málo srovnatelných nabídek — verdikt ber s rezervou.')
    if (cheaper.length) {
      lines.push('', price ? 'Levněji teď:' : 'Nejlevnější teď:')
      for (const o of cheaper) lines.push(`${o.price < suspiciousBelow ? '🚩' : '•'} ${formatCzk(o.price)} — ${o.title} (${o.portal}) ${o.url}`)
    }
  }
  if (flags.length) lines.push('', `🚩 Varovná slova v textu: ${flags.join(', ')}`)
  if (market.errors.length) lines.push('', `Poznámka: ${market.errors.join('; ')}`)

  // --- report ---
  const report = P(`kontrola_${nowStamp(startedAt)}.md`)
  const r = [
    `# Ostř — kontrola ceny (${czechDate(startedAt)})`,
    '',
    `- **Věc:** ${md(title)}`,
    `- **Kontrolovaná cena:** ${price ? formatCzk(price) : '—'}`,
    `- **Dotaz na trh:** ${market.query} (tokeny: ${tokens.join(', ')})`,
    `- **Srovnatelných nabídek:** ${market.comparables.length} z ${market.rawCount} stažených`,
  ]
  if (stats) {
    r.push(
      `- **Medián:** ${formatCzk(stats.median)} · **25.–75. percentil:** ${formatCzk(stats.p25)} – ${formatCzk(stats.p75)} · **rozsah:** ${formatCzk(stats.min)} – ${formatCzk(stats.max)}`,
    )
  }
  if (verdict) r.push('', `## Verdikt: ${verdict.emoji} ${verdict.label}`, '', `${signed(verdict.diffPct)} vs. medián (${verdict.diff > 0 ? '+' : ''}${formatCzk(verdict.diff)}).`, '', verdict.advice)
  if (flags.length) r.push('', '## Varovná slova', '', ...flags.map((f) => `- ${f}`))
  if (market.comparables.length) {
    r.push('', '## Srovnatelné nabídky', '', '| # | Portál | Název | Cena | Odkaz |', '|---|---|---|---|---|')
    market.comparables.slice(0, 40).forEach((o, i) => r.push(`| ${i + 1} | ${o.portal} | ${md(o.title)} | ${formatCzk(o.price)} | ${o.url} |`))
  }
  if (market.errors.length) r.push('', '## Chyby portálů', '', ...market.errors.map((e) => `- ${e}`))
  await writeFile(report, r.join('\n') + '\n', 'utf8')

  const chat = lines.join('\n').trim()
  await saveState({
    mode: 'check',
    check: {
      item: title,
      price,
      query: market.query,
      comparableCount: market.comparables.length,
      stats,
      verdict,
      redFlags: flags,
      cheaper: cheaper.map(({ title, price, portal, url }) => ({ title, price, portal, url })),
      at: new Date().toISOString(),
    },
    lastReport: report,
    lastChatText: chat,
    lastErrors: market.errors,
  })
  await audit({ action: 'price-check', item: title, price, median: stats?.median ?? null, verdict: verdict?.id ?? null, redFlags: flags, report })
  console.log('\n' + chat)
  console.log(JSON.stringify({ ok: true, mode: 'check', verdict: verdict?.id ?? null, median: stats?.median ?? null, report }))
}

// ---------- HLÍDÁNÍ ----------
async function runWatch(config) {
  const startedAt = new Date()
  const watchlist = await readJson(P('watchlist.json'), { items: [] })
  const history = await readJson(P('history.json'), {})
  const w = config.watch ?? {}
  const items = (watchlist.items ?? []).filter((i) => i.active !== false)

  if (!items.length) {
    const chat = '👁️ Ostř — watchlist je prázdný.\nPřidej věc: `/ostr hlidej RTX 3060 12GB --cil 5000`'
    await saveState({ mode: 'watch', watch: { results: [], at: new Date().toISOString() }, lastChatText: chat, lastErrors: [] })
    console.log(chat)
    return
  }

  const results = []
  const errors = []
  for (const item of items) {
    const tokens = buildQueryTokens(item.query, config.stopwords)
    const market = await scanMarket(tokens, config, (m) => console.log(m))
    errors.push(...market.errors)
    const stats = priceStats(market.comparables.map((o) => o.price), config)
    const prev = (history[item.id] ?? []).at(-1) ?? null
    const suspicious = stats ? stats.median * Number(config.verdict?.suspiciousBelowMedian ?? 0.45) : 0

    // nejlevnější nabídka, která NENÍ podezřele levná — podvod nesmí spustit alarm "cíl splněn"
    const honest = market.comparables.filter((o) => o.price >= suspicious)
    const cheapest = honest[0] ?? null
    const suspects = market.comparables.filter((o) => o.price < suspicious).slice(0, 3)

    const alerts = []
    if (cheapest && item.targetPrice && cheapest.price <= item.targetPrice) {
      alerts.push({ type: 'target', text: `🎯 Cíl splněn: ${formatCzk(cheapest.price)} ≤ ${formatCzk(item.targetPrice)}` })
    }
    if (stats && prev?.median) {
      const change = pct(stats.median, prev.median)
      if (change <= -Number(w.alertDropPercent ?? 5)) alerts.push({ type: 'drop', text: `📉 Medián klesl ${signed(change)} (${formatCzk(prev.median)} → ${formatCzk(stats.median)})` })
      if (change >= Number(w.alertDropPercent ?? 5)) alerts.push({ type: 'rise', text: `📈 Medián stoupl ${signed(change)} — když to chceš, nečekej.` })
    }
    if (w.newLowAlert !== false && cheapest && prev?.cheapest && cheapest.price < prev.cheapest && cheapest.url !== prev.cheapestUrl) {
      alerts.push({ type: 'new-low', text: `🆕 Nová nejlevnější nabídka: ${formatCzk(cheapest.price)} (dřív ${formatCzk(prev.cheapest)})` })
    }
    if (suspects.length) alerts.push({ type: 'suspicious', text: `🚩 ${suspects.length}× podezřele levné (pod ${formatCzk(suspicious)}) — ignoruju, ale koukni` })

    if (stats) {
      history[item.id] = [
        ...(history[item.id] ?? []),
        { ts: new Date().toISOString(), median: stats.median, p25: stats.p25, count: stats.count, cheapest: cheapest?.price ?? null, cheapestUrl: cheapest?.url ?? null },
      ].slice(-Number(w.historyLimit ?? 90))
    }

    results.push({
      id: item.id,
      query: item.query,
      targetPrice: item.targetPrice ?? null,
      marketQuery: market.query,
      stats,
      previousMedian: prev?.median ?? null,
      cheapest: cheapest && { title: cheapest.title, price: cheapest.price, portal: cheapest.portal, url: cheapest.url },
      suspects: suspects.map(({ title, price, portal, url }) => ({ title, price, portal, url })),
      alerts,
    })
    console.log(`[Ostř] ${item.query} → ${stats ? `medián ${formatCzk(stats.median)}` : 'bez trhu'} · ${alerts.length} upozornění`)
  }
  await writeJson(P('history.json'), history)

  // --- chat: nejdřív to, co hoří ---
  const hot = results.filter((r) => r.alerts.some((a) => a.type !== 'suspicious'))
  const lines = [`👁️ Ostř — hlídání (${results.length} věcí, ${hot.length} s novinkou)`]
  for (const r of [...hot, ...results.filter((x) => !hot.includes(x))]) {
    lines.push('', `${r.alerts.some((a) => a.type === 'target') ? '🎯' : '•'} ${r.query}${r.targetPrice ? ` (cíl ${formatCzk(r.targetPrice)})` : ''}`)
    if (!r.stats) {
      lines.push('  nic srovnatelného na trhu')
      continue
    }
    lines.push(`  medián ${formatCzk(r.stats.median)} · ${r.stats.count} nabídek${r.cheapest ? ` · nejlevněji ${formatCzk(r.cheapest.price)}` : ''}`)
    for (const a of r.alerts) lines.push(`  ${a.text}`)
    if (r.cheapest && r.alerts.some((a) => a.type === 'target' || a.type === 'new-low')) lines.push(`  ${r.cheapest.url}`)
  }
  if (errors.length) lines.push('', `Poznámka: ${[...new Set(errors)].join('; ')}`)
  const chat = lines.join('\n').trim()

  // --- report ---
  const report = P(`hlidani_${nowStamp(startedAt)}.md`)
  const r = [`# Ostř — hlídání cen (${czechDate(startedAt)})`, '', '| Věc | Cíl | Medián | Minule | Nejlevněji | Upozornění |', '|---|---|---|---|---|---|']
  for (const x of results) {
    r.push(
      `| ${md(x.query)} | ${x.targetPrice ? formatCzk(x.targetPrice) : '—'} | ${x.stats ? formatCzk(x.stats.median) : '—'} | ${x.previousMedian ? formatCzk(x.previousMedian) : '—'} | ${x.cheapest ? `[${formatCzk(x.cheapest.price)}](${x.cheapest.url})` : '—'} | ${md(x.alerts.map((a) => a.text).join('; ') || '—')} |`,
    )
  }
  if (errors.length) r.push('', '## Chyby portálů', '', ...[...new Set(errors)].map((e) => `- ${e}`))
  await writeFile(report, r.join('\n') + '\n', 'utf8')

  await saveState({ mode: 'watch', watch: { results, at: new Date().toISOString() }, lastReport: report, lastChatText: chat, lastErrors: errors })
  await audit({ action: 'price-watch', items: results.length, alerts: results.reduce((n, x) => n + x.alerts.length, 0), targetsHit: results.filter((x) => x.alerts.some((a) => a.type === 'target')).map((x) => x.id), report })
  console.log('\n' + chat)
  console.log(JSON.stringify({ ok: true, mode: 'watch', items: results.length, hot: hot.length, report }))
}

// ---------- watchlist ----------
async function addWatch(query, target) {
  const q = String(query ?? '').trim()
  if (!q) throw new UserError('Co mám hlídat? `/ostr hlidej RTX 3060 12GB --cil 5000`')
  const wl = await readJson(P('watchlist.json'), { items: [] })
  const key = normalize(q)
  const existing = wl.items.find((i) => normalize(i.query) === key)
  if (existing) {
    existing.targetPrice = target ?? existing.targetPrice ?? null
    existing.active = true
  } else {
    wl.items.push({ id: `w${Date.now().toString(36)}`, query: q, targetPrice: target ?? null, active: true, addedAt: new Date().toISOString() })
  }
  await writeJson(P('watchlist.json'), wl)
  const chat = `👁️ Ostř hlídá: ${q}${target ? ` · cíl ${formatCzk(target)}` : ''}\nPrvní kontrola: \`/ostr hlidani\``
  await saveState({ lastChatText: chat })
  await audit({ action: existing ? 'watch-update' : 'watch-add', query: q, targetPrice: target ?? null })
  console.log(chat)
}

async function removeWatch(idOrQuery) {
  const wl = await readJson(P('watchlist.json'), { items: [] })
  const key = normalize(idOrQuery ?? '')
  const before = wl.items.length
  wl.items = wl.items.filter((i) => i.id !== idOrQuery && normalize(i.query) !== key)
  if (wl.items.length === before) throw new UserError(`Ve watchlistu nic takového není: ${idOrQuery}`)
  await writeJson(P('watchlist.json'), wl)
  const chat = `👁️ Ostř přestal hlídat: ${idOrQuery}`
  await saveState({ lastChatText: chat })
  await audit({ action: 'watch-remove', id: idOrQuery })
  console.log(chat)
}

// ---------- main ----------
class UserError extends Error {}

function arg(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const num = (v) => (v === undefined || v === '' ? null : parsePrice(v))

async function main() {
  const config = await readJson(P('config.json'), null)
  if (!config) throw new Error(`Nepodařilo se načíst ${P('config.json')}`)

  const has = (f) => process.argv.includes(f)
  const mode =
    process.env.OSTR_MODE ||
    (has('--watch') ? 'watch' : has('--add') ? 'add' : has('--remove') ? 'remove' : has('--check') ? 'check' : '')
  const item = process.env.OSTR_ITEM ?? arg('--check') ?? arg('--add') ?? ''

  if (mode === 'watch') return runWatch(config)
  if (mode === 'add') return addWatch(item, num(process.env.OSTR_TARGET ?? arg('--target')))
  if (mode === 'remove') return removeWatch(process.env.OSTR_ID ?? arg('--remove'))
  if (mode === 'check' && item.trim()) return runCheck(config, item, num(process.env.OSTR_PRICE ?? arg('--price')))

  throw new UserError(
    'Použití:\n  node run.mjs --check "věc nebo text inzerátu" [--price 9500]\n  node run.mjs --watch\n  node run.mjs --add "věc" [--target 5000]\n  node run.mjs --remove <id>',
  )
}

main().catch(async (err) => {
  const msg = err instanceof UserError ? err.message : `Ostř spadl: ${err?.stack ?? err}`
  console.error(`❌ ${msg}`)
  // ať UI/chat ví, co se stalo — ne jen prázdný výstup
  await saveState({ lastChatText: `🔍 Ostř: ${err instanceof UserError ? err.message : 'běh selhal, detail v audit.json'}`, lastErrors: [String(err?.message ?? err)] }).catch(() => {})
  await audit({ action: 'error', error: String(err?.message ?? err) }).catch(() => {})
  process.exit(err instanceof UserError ? 2 : 1)
})
