// apps/api/src/services/luuu.ts
// LOYO OS // LUUU — mailař. Přečte nové maily (IMAP, jen pro čtení), roztřídí je
// (⭐ důležité · 🧾 faktury · 📰 newslettery · 🗑 spam · 📨 ostatní) a souhrn dá do /daily-brief.
//
// NIKDY: neodesílá, nemaže natrvalo, neoznačuje jako přečtené (čte readOnly), neklikne na odkaz.
// JEDINÁ VÝJIMKA: maily od odesílatelů v LUUU_DELETE přesune do Koše (vratné, Gmail drží 30 dní).
//
// .env:
//   LUUU_IMAP_USER=ty@gmail.com
//   LUUU_IMAP_PASS=heslo-pro-aplikace        (ne hlavní heslo — „App password“ / „Heslo pro aplikace“)
//   LUUU_PROVIDER=gmail | seznam | outlook   (nebo LUUU_IMAP_HOST + LUUU_IMAP_PORT ručně)
//   LUUU_IMPORTANT=sef@firma.cz, @klient.cz  (volitelně: tihle odesílatelé = vždy důležité)
//   LUUU_DELETE=news@alza.cz, @spammer.cz    (volitelně: maily od nich rovnou do Koše)
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { Ollama } from 'ollama'
import { AGENTS_DIR, DATA_DIR } from '../lib/dataPaths.js'
import { logActivity } from '../routes/activity.js'
import { envValue } from './telegramNotify.js'

const DIR = join(AGENTS_DIR, 'luuu')
const STATE = join(DIR, 'state.json')
const REPORTS = join(DATA_DIR, 'reports')
const MAX_MAILS = 60

const PRESETS: Record<string, { host: string; port: number }> = {
  gmail: { host: 'imap.gmail.com', port: 993 },
  seznam: { host: 'imap.seznam.cz', port: 993 },
  outlook: { host: 'outlook.office365.com', port: 993 },
  hotmail: { host: 'outlook.office365.com', port: 993 },
  centrum: { host: 'imap.centrum.cz', port: 993 },
  email: { host: 'imap.email.cz', port: 993 },
}

export type Category = 'dulezite' | 'faktury' | 'newsletter' | 'spam' | 'ostatni'
export const CAT_LABEL: Record<Category, string> = {
  dulezite: '⭐ Důležité', faktury: '🧾 Faktury a platby', newsletter: '📰 Newslettery a reklama', spam: '🗑 Spam', ostatni: '📨 Ostatní',
}

export type Mail = { uid: number; from: string; fromAddr: string; subject: string; date: string; snippet: string; listUnsubscribe: boolean; hasPdf: boolean }
type Classified = Mail & { cat: Category; why: string }

async function readState(): Promise<any> {
  try { return JSON.parse(await readFile(STATE, 'utf8')) } catch { return {} }
}
async function writeState(s: any) {
  await mkdir(DIR, { recursive: true })
  await writeFile(STATE, JSON.stringify(s, null, 2), 'utf8')
}

async function config() {
  const user = await envValue('LUUU_IMAP_USER')
  // Google ukazuje heslo pro aplikace s mezerami („abcd efgh ijkl mnop“) — pryč s nimi
  const pass = (await envValue('LUUU_IMAP_PASS')).replace(/\s+/g, '')
  const provider = (await envValue('LUUU_PROVIDER')).toLowerCase() || (user.split('@')[1] ?? '').split('.')[0]
  const preset = PRESETS[provider]
  const host = (await envValue('LUUU_IMAP_HOST')) || preset?.host || ''
  const port = Number(await envValue('LUUU_IMAP_PORT')) || preset?.port || 993
  const list = async (key: string) => (await envValue(key)).split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean)
  const important = await list('LUUU_IMPORTANT')
  // odesílatelé, jejichž maily jdou rovnou do koše (adresa nebo @domena)
  const del = await list('LUUU_DELETE')
  return { user, pass, host, port, important, del, ok: !!(user && pass && host) }
}

export async function luuuConfigured(): Promise<boolean> {
  return (await config()).ok
}

export const SETUP_HELP = [
  '📬 Luuu ještě nemá přístup k mailu. Do .env v rootu projektu (D:\\dev\\loyo-os\\.env) dej:',
  '',
  'LUUU_IMAP_USER=tvuj@email.cz',
  'LUUU_IMAP_PASS=heslo-pro-aplikace',
  'LUUU_PROVIDER=gmail        (nebo seznam / outlook)',
  '',
  'Heslo NENÍ tvoje hlavní heslo, ale „heslo pro aplikace“ (16 znaků):',
  '• Gmail: v menu ho nenajdeš — otevři přímo https://myaccount.google.com/apppasswords',
  '  (napřed musí být zapnuté dvoufázové ověření: https://myaccount.google.com/signinoptions/twosv)',
  '  Pozor: „Přístupové a bezpečnostní klíče“ (passkeys) jsou něco jiného.',
  '• Seznam: Nastavení → Hesla pro aplikace (a zapnout IMAP v nastavení pošty)',
  '• Outlook: https://account.live.com/proofs/AppPassword',
  '',
  'Pak /luuu. Luuu poštu jen čte — nic neodešle, nesmaže ani neoznačí jako přečtené.',
].join('\n')

// ---------- stažení nových mailů ----------
async function fetchNew(days: number | null): Promise<{ mails: Mail[]; lastUid: number }> {
  const cfg = await config()
  if (!cfg.ok) throw new Error('not-configured')
  const state = await readState()
  const client = new ImapFlow({ host: cfg.host, port: cfg.port, secure: true, auth: { user: cfg.user, pass: cfg.pass }, logger: false })
  await client.connect()
  const mails: Mail[] = []
  let lastUid = Number(state.lastUid) || 0
  try {
    // readOnly = nic se neoznačí jako přečtené
    const box = await client.mailboxOpen('INBOX', { readOnly: true })
    if (state.uidValidity && String(state.uidValidity) !== String(box.uidValidity)) lastUid = 0
    const since = new Date(Date.now() - (days ?? 1) * 86_400_000)
    const query: any = lastUid && days == null ? { uid: `${lastUid + 1}:*` } : { since }
    const uids = ((await client.search(query, { uid: true })) || []).filter((u: number) => u > (days == null ? lastUid : 0))
    for await (const msg of client.fetch(uids.slice(-MAX_MAILS), { uid: true, source: true }, { uid: true })) {
      const parsed: any = await simpleParser(msg.source as Buffer)
      const fromObj = parsed.from?.value?.[0] ?? {}
      const text = String(parsed.text ?? parsed.html?.replace(/<[^>]+>/g, ' ') ?? '').replace(/\s+/g, ' ').trim()
      mails.push({
        uid: msg.uid,
        from: fromObj.name || fromObj.address || '?',
        fromAddr: String(fromObj.address ?? '').toLowerCase(),
        subject: String(parsed.subject ?? '(bez předmětu)'),
        date: (parsed.date ?? new Date()).toISOString(),
        snippet: text.slice(0, 400),
        listUnsubscribe: !!parsed.headers?.get?.('list-unsubscribe'),
        hasPdf: (parsed.attachments ?? []).some((a: any) => /pdf/i.test(a.contentType ?? '') || /\.pdf$/i.test(a.filename ?? '')),
      })
      lastUid = Math.max(lastUid, msg.uid)
    }
    await writeState({ ...state, lastUid, uidValidity: String(box.uidValidity) })
  } finally {
    await client.logout().catch(() => {})
  }
  return { mails, lastUid }
}

// ---------- cílené mazání: LUUU_DELETE → Koš (ne natrvalo; Gmail ho drží 30 dní) ----------
export function matchesSender(fromAddr: string, list: string[]): boolean {
  const a = fromAddr.toLowerCase()
  return list.some((x) => (x.startsWith('@') ? a.endsWith(x) : a === x))
}

async function moveToTrash(uids: number[]): Promise<{ moved: number; trash: string }> {
  if (!uids.length) return { moved: 0, trash: '' }
  const cfg = await config()
  const client = new ImapFlow({ host: cfg.host, port: cfg.port, secure: true, auth: { user: cfg.user, pass: cfg.pass }, logger: false })
  await client.connect()
  try {
    const boxes: any[] = await client.list()
    const trash = boxes.find((b) => b.specialUse === '\\Trash')?.path
    if (!trash) throw new Error('nenašel jsem složku Koš (\\Trash)')
    await client.mailboxOpen('INBOX') // tady je potřeba zápis — jen pro přesun vybraných mailů
    await client.messageMove(uids.join(','), trash, { uid: true })
    return { moved: uids.length, trash }
  } finally {
    await client.logout().catch(() => {})
  }
}

// ---------- třídění: pravidla, pak lokální LLM na zbytek ----------
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export function classifyByRules(m: Mail, important: string[] = []): { cat: Category; why: string } | null {
  const subj = norm(m.subject)
  const body = norm(m.snippet)
  const from = m.fromAddr
  if (important.some((x) => (x.startsWith('@') ? from.endsWith(x) : from === x))) return { cat: 'dulezite', why: 'odesílatel ze seznamu důležitých' }
  if (/(vyhral|vyhra|lottery|bitcoin|crypto\s*invest|viagra|casino|nigerian|inheritance|dedictvi|urgent\s+transfer)/.test(subj + ' ' + body)) return { cat: 'spam', why: 'typický spam' }
  if (/(faktur|invoice|vyuctovani|uctenk|receipt|platb|zaplat|upominka|splatnost|dobropis|proforma|objednavk.*zaplacen|payment)/.test(subj) || (m.hasPdf && /(faktur|invoice|doklad)/.test(subj + body)))
    return { cat: 'faktury', why: 'faktura / platba' }
  if (m.listUnsubscribe || /(newsletter|odhlasit|unsubscribe|sleva|akce|vyprodej|% off|black friday|novinky)/.test(subj + ' ' + body.slice(0, 200)))
    return { cat: 'newsletter', why: m.listUnsubscribe ? 'hromadná rozesílka (List-Unsubscribe)' : 'reklama / newsletter' }
  if (/(no-?reply|noreply|notification|notifikace|mailer-daemon)/.test(from)) return { cat: 'ostatni', why: 'automatická zpráva' }
  return null
}

async function classifyByLlm(mails: Mail[]): Promise<Map<number, Category>> {
  const out = new Map<number, Category>()
  if (!mails.length) return out
  const model = (await envValue('LUUU_MODEL')) || 'qwen3.5:27b'
  const list = mails.map((m, i) => `${i + 1}) Od: ${m.from} <${m.fromAddr}> | Předmět: ${m.subject} | ${m.snippet.slice(0, 160)}`).join('\n')
  try {
    const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' })
    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 90_000))
    const res: any = await Promise.race([
      ollama.chat({
        model,
        messages: [
          { role: 'system', content: 'Roztřiď e-maily. Ke každému číslu napiš jedno slovo: dulezite (osobní, pracovní, vyžaduje odpověď/akci), ostatni, spam. Formát řádku: "1: dulezite". Nic dalšího.' },
          { role: 'user', content: list },
        ],
        options: { temperature: 0 },
      }),
      timeout,
    ])
    for (const line of String(res?.message?.content ?? '').split('\n')) {
      const m = line.match(/(\d+)\s*[:.)-]\s*(dulezite|důležité|ostatni|ostatní|spam)/i)
      if (!m) continue
      const mail = mails[Number(m[1]) - 1]
      if (mail) out.set(mail.uid, norm(m[2]).startsWith('dulez') ? 'dulezite' : norm(m[2]) === 'spam' ? 'spam' : 'ostatni')
    }
  } catch {}
  return out
}

export async function classify(mails: Mail[], important: string[] = []): Promise<Classified[]> {
  const rest: Mail[] = []
  const done: Classified[] = []
  for (const m of mails) {
    const r = classifyByRules(m, important)
    if (r) done.push({ ...m, ...r })
    else rest.push(m)
  }
  const llm = await classifyByLlm(rest)
  // když model neodpoví: člověk z osobní adresy (ne rozesílka) = spíš důležité
  const PERSONAL = /@(gmail|seznam|email|centrum|post|volny|atlas|outlook|hotmail|icloud|yahoo|tiscali)\./
  for (const m of rest) {
    const cat = llm.get(m.uid)
    if (cat) done.push({ ...m, cat, why: 'LLM' })
    else if (PERSONAL.test(m.fromAddr) && !m.listUnsubscribe) done.push({ ...m, cat: 'dulezite', why: 'osobní adresa' })
    else done.push({ ...m, cat: 'ostatni', why: 'bez pravidla' })
  }
  return done
}

export function formatSummary(items: Classified[], title = '📬 Luuu — nové maily'): string {
  if (!items.length) return `${title}\nNic nového. 🎉`
  const order: Category[] = ['dulezite', 'faktury', 'ostatni', 'newsletter', 'spam']
  const lines = [`${title}: ${items.length}`]
  for (const cat of order) {
    const list = items.filter((i) => i.cat === cat).sort((a, b) => b.date.localeCompare(a.date))
    if (!list.length) continue
    lines.push('', `${CAT_LABEL[cat]} (${list.length})`)
    const detailed = cat === 'dulezite' || cat === 'faktury' || cat === 'ostatni'
    for (const m of list.slice(0, detailed ? 10 : 5)) lines.push(`• ${m.from} — ${m.subject}${m.hasPdf && cat === 'faktury' ? ' 📎PDF' : ''}`)
    if (list.length > (detailed ? 10 : 5)) lines.push(`  … a dalších ${list.length - (detailed ? 10 : 5)}`)
  }
  return lines.join('\n')
}

/** Spustí Luua: stáhne nové maily, roztřídí, uloží souhrn. days = podívat se zpět X dní (jinak jen nové od minula). */
export async function runLuuu(days: number | null = null): Promise<{ text: string; count: number }> {
  if (!(await luuuConfigured())) return { text: SETUP_HELP, count: 0 }
  await logActivity({ agent: 'Luuu', type: 'system', action: `čte poštu${days ? ` (posledních ${days} dní)` : ''}` }).catch(() => {})
  let mails: Mail[]
  try {
    ;({ mails } = await fetchNew(days))
  } catch (e: any) {
    const msg = String(e?.message ?? e)
    const hint = /auth|login|credential|invalid/i.test(msg) ? '\nNejspíš špatné heslo pro aplikace, nebo nemáš ve schránce zapnutý IMAP.' : ''
    await logActivity({ agent: 'Luuu', type: 'error', action: `pošta selhala: ${msg.slice(0, 120)}` }).catch(() => {})
    return { text: `❌ Luuu se nedostal do pošty: ${msg}${hint}`, count: 0 }
  }
  const cfg = await config()

  // LUUU_DELETE: tihle odesílatelé jdou do koše a do souhrnu se nepočítají
  const toTrash = cfg.del.length ? mails.filter((m) => matchesSender(m.fromAddr, cfg.del)) : []
  let trashNote = ''
  if (toTrash.length) {
    try {
      const { moved, trash } = await moveToTrash(toTrash.map((m) => m.uid))
      mails = mails.filter((m) => !toTrash.includes(m))
      trashNote = [`🗑 Do koše (${trash}) podle LUUU_DELETE: ${moved}`, ...toTrash.slice(0, 10).map((m) => `• ${m.from} — ${m.subject}`), ...(toTrash.length > 10 ? [`  … a dalších ${toTrash.length - 10}`] : [])].join('\n')
      await logActivity({ agent: 'Luuu', type: 'system', action: `přesunul ${moved} mailů do koše (LUUU_DELETE)` }).catch(() => {})
    } catch (e: any) {
      trashNote = `⚠ Mazání podle LUUU_DELETE selhalo: ${e?.message ?? e}`
    }
  }

  const items = await classify(mails, cfg.important)
  const text = trashNote ? `${formatSummary(items)}\n\n${trashNote}` : formatSummary(items)
  const state = await readState()
  await writeState({ ...state, lastRun: new Date().toISOString(), lastSummary: text, lastCounts: Object.fromEntries((Object.keys(CAT_LABEL) as Category[]).map((c) => [c, items.filter((i) => i.cat === c).length])) })
  await mkdir(REPORTS, { recursive: true })
  await writeFile(join(REPORTS, `luuu_${new Date().toISOString().slice(0, 10)}.md`), text + '\n', { encoding: 'utf8', flag: 'a' })
  const importantCount = items.filter((i) => i.cat === 'dulezite').length
  await logActivity({ agent: 'Luuu', type: 'system', action: `roztřídil ${items.length} mailů (${importantCount} důležitých)` }).catch(() => {})
  // oznámení v horní liště: důležité = NUTNÉ, ostatní nové maily = NOVÉ
  import('./scheduler.js').then((s) => {
    if (importantCount) s.pushNotification('urgent', '/luuu', `⭐ ${importantCount} důležitých mailů: ${items.filter((i) => i.cat === 'dulezite').slice(0, 3).map((i) => i.from).join(', ')}`)
    else if (items.length) s.pushNotification('new', '/luuu', `📬 ${items.length} nových mailů (${items.filter((i) => i.cat === 'faktury').length} faktur)`)
  }).catch(() => {})
  return { text, count: items.length }
}

/** Tlačítka v UI: maily dané kategorie (spam / newslettery) za posledních N dní přesune do Koše. */
export async function trashCategory(cat: Category, days = 7): Promise<{ text: string; moved: number }> {
  if (!(await luuuConfigured())) return { text: SETUP_HELP, moved: 0 }
  if (cat !== 'spam' && cat !== 'newsletter') return { text: 'Do koše jde hromadně jen spam a newslettery.', moved: 0 }
  const cfg = await config()
  const { mails } = await fetchNew(days)
  const items = (await classify(mails, cfg.important)).filter((m) => m.cat === cat)
  if (!items.length) return { text: `${CAT_LABEL[cat]}: za posledních ${days} dní nic. 🎉`, moved: 0 }
  const { moved, trash } = await moveToTrash(items.map((m) => m.uid))
  await logActivity({ agent: 'Luuu', type: 'system', action: `${CAT_LABEL[cat]} → koš: ${moved} (${days} dní)` }).catch(() => {})
  return {
    text: [`🗑 ${CAT_LABEL[cat]} → ${trash}: ${moved}`, ...items.slice(0, 15).map((m) => `• ${m.from} — ${m.subject}`), ...(items.length > 15 ? [`… a dalších ${items.length - 15}`] : []), '', 'Vrátit jde z Koše v Gmailu (30 dní).'].join('\n'),
    moved,
  }
}

// ---------- celá schránka: spam / newslettery (jen hlavičky, pravidla — tisíce mailů bez LLM) ----------
// Výsledek je seskupený podle odesílatele: v UI jde každého odškrtnout (= všechny jeho maily zůstanou).
export type SenderGroup = { addr: string; name: string; inbox: number[]; junk: number[] }
export type WholeScan = {
  id: string
  cat: 'spam' | 'newsletter'
  scanned: number
  junkPath: string | null
  groups: SenderGroup[]          // seřazené od nejvíc mailů
  createdAt: number
}

const scans = new Map<string, WholeScan>()   // pro UI: sken → výběr → smazání (platí 30 min)
export function getScan(id: string): WholeScan | null {
  for (const [k, v] of scans) if (Date.now() - v.createdAt > 30 * 60_000) scans.delete(k)
  return scans.get(id) ?? null
}

function connectClient(cfg: Awaited<ReturnType<typeof config>>) {
  return new ImapFlow({ host: cfg.host, port: cfg.port, secure: true, auth: { user: cfg.user, pass: cfg.pass }, logger: false })
}

function toMail(msg: any): Mail {
  const env: any = msg.envelope ?? {}
  const from = env.from?.[0] ?? {}
  return {
    uid: msg.uid,
    from: from.name || from.address || '?',
    fromAddr: String(from.address ?? '').toLowerCase(),
    subject: String(env.subject ?? ''),
    date: env.date instanceof Date ? env.date.toISOString() : String(env.date ?? ''),
    snippet: '',
    listUnsubscribe: /list-unsubscribe/i.test(String(msg.headers ?? '')),
    hasPdf: false,
  }
}

/** Projde CELOU doručenou poštu (jen pro čtení) + u spamu i Gmail složku Spam. Nic nemaže. */
export async function scanWholeMailbox(cat: 'spam' | 'newsletter'): Promise<WholeScan> {
  const cfg = await config()
  if (!cfg.ok) throw new Error('not-configured')
  const client = connectClient(cfg)
  await client.connect()
  const by = new Map<string, SenderGroup>()
  const add = (m: Mail, where: 'inbox' | 'junk') => {
    const key = m.fromAddr || m.from
    const g = by.get(key) ?? { addr: key, name: m.from, inbox: [], junk: [] }
    g[where].push(m.uid)
    by.set(key, g)
  }
  let scanned = 0
  let junkPath: string | null = null
  try {
    if (cat === 'spam') {
      const boxes: any[] = await client.list()
      junkPath = boxes.find((b) => b.specialUse === '\\Junk')?.path ?? null
      if (junkPath) {
        const jb: any = await client.mailboxOpen(junkPath, { readOnly: true })
        if (jb.exists) for await (const msg of client.fetch('1:*', { uid: true, envelope: true })) add(toMail(msg), 'junk')
      }
    }
    const box: any = await client.mailboxOpen('INBOX', { readOnly: true })
    if (box.exists) {
      for await (const msg of client.fetch('1:*', { uid: true, envelope: true, headers: ['list-unsubscribe'] })) {
        scanned++
        const m = toMail(msg)
        if (classifyByRules(m, cfg.important)?.cat === cat) add(m, 'inbox')
      }
    }
  } finally {
    await client.logout().catch(() => {})
  }
  const groups = [...by.values()].sort((x, y) => (y.inbox.length + y.junk.length) - (x.inbox.length + x.junk.length))
  const scan: WholeScan = { id: Math.random().toString(36).slice(2, 10), cat, scanned, junkPath, groups, createdAt: Date.now() }
  scans.set(scan.id, scan)
  return scan
}

export const scanTotal = (scan: WholeScan, exclude: string[] = []) =>
  scan.groups.filter((g) => !exclude.includes(g.addr)).reduce((n, g) => n + g.inbox.length + g.junk.length, 0)

/** Přesune do Koše maily ze skenu — kromě odškrtnutých odesílatelů (exclude). Vratné 30 dní. */
export async function trashWholeScan(scan: WholeScan, exclude: string[] = []): Promise<string> {
  const keep = new Set(exclude.map((x) => x.toLowerCase()))
  const chosen = scan.groups.filter((g) => !keep.has(g.addr.toLowerCase()))
  const inboxUids = chosen.flatMap((g) => g.inbox)
  const junkUids = chosen.flatMap((g) => g.junk)
  const cfg = await config()
  const client = connectClient(cfg)
  await client.connect()
  let fromInbox = 0
  let fromJunk = 0
  let trash = ''
  try {
    const boxes: any[] = await client.list()
    trash = boxes.find((b) => b.specialUse === '\\Trash')?.path ?? ''
    if (!trash) throw new Error('nenašel jsem složku Koš (\\Trash)')
    const move = async (mailbox: string, uids: number[]) => {
      if (!uids.length) return 0
      await client.mailboxOpen(mailbox)
      let n = 0
      for (let i = 0; i < uids.length; i += 500) {
        const chunk = uids.slice(i, i + 500)
        await client.messageMove(chunk.join(','), trash, { uid: true })
        n += chunk.length
      }
      return n
    }
    fromInbox = await move('INBOX', inboxUids)
    if (scan.junkPath) fromJunk = await move(scan.junkPath, junkUids)
  } finally {
    await client.logout().catch(() => {})
  }
  scans.delete(scan.id)
  await logActivity({
    agent: 'Luuu', type: 'system',
    action: `celá schránka: ${CAT_LABEL[scan.cat]} → koš (${fromInbox} z doručené, ${fromJunk} ze Spamu; ${keep.size} odesílatelů ponecháno)`,
    meta: { cat: scan.cat, fromInbox, fromJunk, kept: [...keep], senders: chosen.length },
  }).catch(() => {})
  return `🗑 Hotovo → ${trash}\n• z doručené pošty: ${fromInbox}${scan.cat === 'spam' ? `\n• ze složky Spam: ${fromJunk}` : ''}${keep.size ? `\n• ponecháno odesílatelů: ${keep.size}` : ''}\n\nVrátit jde z Koše v Gmailu (30 dní, pak ho Gmail vysype sám).`
}

/** Text do chatu: jen počty podle odesílatele (žádné předměty). */
export function describeScan(scan: WholeScan): string {
  const inbox = scan.groups.reduce((n, g) => n + g.inbox.length, 0)
  const junk = scan.groups.reduce((n, g) => n + g.junk.length, 0)
  const top = scan.groups.slice(0, 15).map((g) => `• ${g.name !== g.addr ? `${g.name} <${g.addr}>` : g.addr} — ${g.inbox.length + g.junk.length}×`)
  return [
    `📬 ${CAT_LABEL[scan.cat]} v celé schránce (prošel jsem ${scan.scanned} mailů v doručené):`,
    `• v doručené poště: ${inbox}`,
    ...(scan.cat === 'spam' ? [`• ve složce Spam${scan.junkPath ? ` (${scan.junkPath})` : ''}: ${junk}`] : []),
    `= celkem ${inbox + junk} od ${scan.groups.length} odesílatelů`,
    ...(top.length ? ['', 'Nejvíc od:', ...top, ...(scan.groups.length > 15 ? [`… a dalších ${scan.groups.length - 15} odesílatelů`] : [])] : []),
    '',
    'Odškrtnout jednotlivé odesílatele jde v UI: Agenti → Luuu.',
  ].join('\n')
}

/** Stav pro panel v UI. Heslo se nikdy nevrací. */
export async function luuuStatus() {
  const cfg = await config()
  const state = await readState()
  return {
    configured: cfg.ok,
    user: cfg.user || null,
    host: cfg.host || null,
    important: cfg.important,
    del: cfg.del,
    lastRun: state.lastRun ?? null,
    lastCounts: state.lastCounts ?? null,
    lastSummary: state.lastSummary ?? null,
    setupHelp: cfg.ok ? null : SETUP_HELP,
  }
}

/** Uloží seznamy LUUU_IMPORTANT / LUUU_DELETE do .env (ostatní řádky nechá být). */
export async function saveLists(lists: { important?: string[]; del?: string[] }): Promise<void> {
  const ENV = join(DATA_DIR, '..', '.env')
  let raw = await readFile(ENV, 'utf8').catch(() => '')
  const clean = (l: string[]) => [...new Set(l.map((x) => x.trim().toLowerCase()).filter((x) => /^(@[\w.-]+\.[a-z]{2,}|[\w.+-]+@[\w.-]+\.[a-z]{2,})$/i.test(x)))].join(', ')
  const setKey = (key: string, value: string) => {
    const re = new RegExp(`^\\s*${key}\\s*=.*$`, 'm')
    raw = re.test(raw) ? raw.replace(re, `${key}=${value}`) : `${raw.replace(/\s*$/, '')}\n${key}=${value}\n`
  }
  if (lists.important) setKey('LUUU_IMPORTANT', clean(lists.important))
  if (lists.del) setKey('LUUU_DELETE', clean(lists.del))
  await writeFile(ENV, raw, 'utf8')
}

/** Sekce do ranního přehledu. Když Luuu není nastavený, vrátí prázdný řetězec. */
export async function luuuBriefSection(): Promise<string> {
  if (!(await luuuConfigured())) return ''
  const { text } = await runLuuu(1).catch(() => ({ text: '' }))
  return text
}
