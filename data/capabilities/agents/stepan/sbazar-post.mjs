#!/usr/bin/env node
// data/capabilities/agents/stepan/sbazar-post.mjs
// Stěpán → Sbazar: otevře formulář "Nová nabídka" v Edge pod tvým účtem Seznam,
// vyplní titulek, popis, cenu a fotky a ZASTAVÍ SE před zveřejněním. Klikneš sám.
//
//   node sbazar-post.mjs --login          jednorázově: otevře přihlášení, přihlásíš se ručně
//   node sbazar-post.mjs                  vyplní inzerát ze state.json (poslední běh Stěpána)
//   node sbazar-post.mjs --photos <složka nebo soubory oddělené ;>
//   node sbazar-post.mjs --dump           jen uloží strukturu formuláře do sbazar-form.json
//
// Přihlášení se drží v .edge-profile/ (gitignore). Heslo agent nikdy nezadává ani nevidí.

import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises'
import { dirname, join, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const __dirname = dirname(fileURLToPath(import.meta.url))
const P = (f) => join(__dirname, f)
const PROFILE_DIR = P('.edge-profile')
const NEW_OFFER_URL = 'https://www.sbazar.cz/nova-nabidka'
const LOGIN_URL = `https://login.seznam.cz/?service=sbazar&return_url=${encodeURIComponent(NEW_OFFER_URL)}`
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.gif'])
const KEEP_OPEN_MS = 30 * 60_000

const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const has = (name) => process.argv.includes(name)

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
}

// stav vkládání jde do state.json → UI i chat vidí, jak to dopadlo
async function report(patch, chatText) {
  const state = await readJson(P('state.json'), {})
  state.sbazar = { ...(state.sbazar ?? {}), ...patch, at: new Date().toISOString() }
  if (chatText) state.lastSbazarText = chatText
  await writeFile(P('state.json'), JSON.stringify(state, null, 2), 'utf8')
  if (chatText) console.log(chatText)
}

async function resolvePhotos(spec) {
  if (!spec) return []
  const out = []
  for (const part of String(spec).split(/[;\n]/).map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean)) {
    const full = resolve(part)
    let info
    try {
      info = await stat(full)
    } catch {
      continue
    }
    if (info.isDirectory()) {
      const files = (await readdir(full)).filter((f) => IMAGE_EXT.has(extname(f).toLowerCase())).sort()
      out.push(...files.map((f) => join(full, f)))
    } else if (IMAGE_EXT.has(extname(full).toLowerCase())) {
      out.push(full)
    }
  }
  return [...new Set(out)].slice(0, 20)
}

async function launch() {
  await mkdir(PROFILE_DIR, { recursive: true })
  return chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'msedge',
    headless: false,
    viewport: null,
    locale: 'cs-CZ',
    args: ['--start-maximized'],
  })
}

const host = (url) => {
  try {
    return new URL(String(url)).hostname
  } catch {
    return ''
  }
}
// Přihlášení i souhlas s cookies (cmp.seznam.cz) jsou na uživateli — agent jen čeká.
// Pozor: return_url v query obsahuje "sbazar.cz", proto se porovnává jen hostname.
const needsUser = (page) => host(page.url()) !== 'www.sbazar.cz'
const onSbazar = (path) => (url) => host(url) === 'www.sbazar.cz' && (!path || new URL(String(url)).pathname.startsWith(path))

// Struktura formuláře pro ladění selektorů (bez hodnot — jen popisky a typy polí).
async function dumpForm(page) {
  const fields = await page.evaluate(() => {
    const labelOf = (el) => {
      if (el.id) {
        const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
        if (l) return l.textContent.trim()
      }
      return el.closest('label')?.textContent.trim() ?? ''
    }
    return [...document.querySelectorAll('input, textarea, select, button, [contenteditable="true"], [role="combobox"]')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') ?? '',
      name: el.getAttribute('name') ?? '',
      id: el.id ?? '',
      placeholder: el.getAttribute('placeholder') ?? '',
      aria: el.getAttribute('aria-label') ?? '',
      label: labelOf(el).slice(0, 80),
      text: el.tagName === 'BUTTON' ? el.textContent.trim().slice(0, 60) : '',
      testid: el.getAttribute('data-testid') ?? el.getAttribute('data-e2e') ?? '',
    }))
  })
  await writeFile(P('sbazar-form.json'), JSON.stringify({ url: page.url(), at: new Date().toISOString(), fields }, null, 2), 'utf8')
  return fields.length
}

// Zkouší víc cest k poli: popisek → placeholder → name/id. První viditelný vyhrává.
async function findField(page, { labels, attrs, tag = 'input' }) {
  const candidates = [
    ...labels.map((re) => page.getByLabel(re)),
    ...labels.map((re) => page.getByPlaceholder(re)),
    ...attrs.map((a) => page.locator(`${tag}[name*="${a}" i], ${tag}[id*="${a}" i], ${tag}[data-testid*="${a}" i]`)),
  ]
  for (const loc of candidates) {
    const el = loc.first()
    if ((await el.count().catch(() => 0)) && (await el.isVisible().catch(() => false))) return el
  }
  return null
}

async function fillField(page, name, spec, value, filled, missing) {
  if (value === undefined || value === null || value === '') return
  const el = await findField(page, spec)
  if (!el) return missing.push(name)
  try {
    await el.fill(String(value))
    filled.push(name)
  } catch {
    missing.push(name)
  }
}

async function login() {
  const ctx = await launch()
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  await page.goto(LOGIN_URL)
  console.log('[Stěpán] Přihlas se v otevřeném okně Edge. Čekám max 10 minut…')
  try {
    await page.waitForURL(onSbazar(), { timeout: 10 * 60_000 })
    await report({ loggedIn: true }, '🔑 Stěpán: přihlášení k Sbazaru uložené. Teď stačí `/stepan <věc> --cena N --vlozit`.')
  } catch {
    await report({ loggedIn: false }, '🔑 Stěpán: přihlášení nedokončeno (vypršel čas nebo zavřené okno).')
  }
  await ctx.close().catch(() => {})
}

async function post() {
  const state = await readJson(P('state.json'), {})
  const listing = state.listing ?? {}
  const title = arg('--title') ?? listing.title
  const body = arg('--body') ?? listing.body
  const price = arg('--price') ?? listing.price ?? ''
  const photos = await resolvePhotos(arg('--photos') || process.env.STEPAN_PHOTOS || state.photos)

  if (!title || !body) {
    await report({ ok: false }, '❌ Stěpán: nemám inzerát. Nejdřív `/stepan <věc> --cena N`.')
    process.exit(2)
  }

  const ctx = await launch()
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  await page.goto(NEW_OFFER_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

  if (needsUser(page)) {
    await report(
      { ok: false, loggedIn: false },
      '🔑 Stěpán: Seznam chce přihlášení (případně souhlas s cookies). Vyřiď to v otevřeném okně, formulář pak vyplním sám.',
    )
    try {
      await page.waitForURL(onSbazar('/nova-nabidka'), { timeout: 10 * 60_000 })
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    } catch {
      await ctx.close().catch(() => {})
      process.exit(3)
    }
  }

  // cookie lišta Seznamu — jen pokud překáží, a vždy volba bez souhlasu navíc
  await page.getByRole('button', { name: /odmítnout|pouze nezbytné|nesouhlasím/i }).first().click({ timeout: 2000 }).catch(() => {})

  const fieldCount = await dumpForm(page).catch(() => 0)
  if (has('--dump')) {
    console.log(`[Stěpán] formulář: ${fieldCount} polí → sbazar-form.json`)
    await ctx.close()
    return
  }

  const filled = []
  const missing = []

  // fotky jako první — některé formuláře odemknou zbytek až po nahrání
  if (photos.length) {
    const input = page.locator('input[type="file"]').first()
    if (await input.count().catch(() => 0)) {
      try {
        await input.setInputFiles(photos)
        filled.push(`fotky (${photos.length})`)
        await page.waitForTimeout(1500)
      } catch {
        missing.push('fotky')
      }
    } else missing.push('fotky')
  }

  await fillField(page, 'titulek', { labels: [/název|titulek|nadpis/i], attrs: ['name', 'title', 'nazev'] }, title, filled, missing)
  await fillField(page, 'popis', { labels: [/popis/i], attrs: ['description', 'popis', 'text'], tag: 'textarea' }, body, filled, missing)
  await fillField(page, 'cena', { labels: [/^cena|cena\b/i], attrs: ['price', 'cena'] }, price ? String(price).replace(/\D/g, '') : '', filled, missing)

  const shot = P(`sbazar_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`)
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {})

  const lines = [
    '📝 Stěpán: inzerát předvyplněný na Sbazaru — NEZVEŘEJNĚNÝ.',
    `Vyplněno: ${filled.join(', ') || 'nic'}`,
  ]
  if (missing.length) lines.push(`Doplň ručně: ${missing.join(', ')}`)
  if (!photos.length) lines.push('Fotky: žádné — přidej je ve formuláři.')
  lines.push('Zkontroluj kategorii a lokalitu a klikni na zveřejnění sám. Okno nechám otevřené 30 minut.')
  await report({ ok: true, filled, missing, photos: photos.length, screenshot: shot, published: false }, lines.join('\n'))

  // Okno zůstane otevřené pro ruční kontrolu a zveřejnění. Agent sám nic neodesílá.
  await Promise.race([
    new Promise((r) => ctx.on('close', r)),
    new Promise((r) => setTimeout(r, KEEP_OPEN_MS)),
  ])
  await ctx.close().catch(() => {})
}

;(has('--login') ? login() : post()).catch(async (err) => {
  console.error(`❌ Sbazar: ${err?.message ?? err}`)
  await report({ ok: false, error: String(err?.message ?? err) }, `❌ Stěpán → Sbazar selhal: ${err?.message ?? err}`).catch(() => {})
  process.exit(1)
})
