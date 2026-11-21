// apps/api/src/services/mailSend.ts
// LOYO OS // MARY JANE — /mejl: odeslání e-mailu z tvé schránky (stejné heslo pro aplikace jako Luuu).
//   /mejl Předmět - text zprávy                 → tobě samotnému (poznámka do mailu)
//   /mejl kamarad@seznam.cz Předmět - text      → komukoli
// Vždy nejdřív náhled + potvrzení (✅ / „ano“) — nic neodejde samo.
import nodemailer from 'nodemailer'
import { logActivity } from '../routes/activity.js'
import { envValue } from './telegramNotify.js'
import { askConfirm } from './shellPolicy.js'

type CommandResult = { reply: string; steps: string[] }

const SMTP: Record<string, { host: string; port: number; secure: boolean }> = {
  gmail: { host: 'smtp.gmail.com', port: 465, secure: true },
  seznam: { host: 'smtp.seznam.cz', port: 465, secure: true },
  outlook: { host: 'smtp-mail.outlook.com', port: 587, secure: false },
  hotmail: { host: 'smtp-mail.outlook.com', port: 587, secure: false },
  centrum: { host: 'smtp.centrum.cz', port: 465, secure: true },
  email: { host: 'smtp.email.cz', port: 465, secure: true },
}

async function smtpConfig() {
  const user = await envValue('LUUU_IMAP_USER')
  const pass = (await envValue('LUUU_IMAP_PASS')).replace(/\s+/g, '')
  const provider = (await envValue('LUUU_PROVIDER')).toLowerCase() || (user.split('@')[1] ?? '').split('.')[0]
  const preset = SMTP[provider]
  const host = (await envValue('MAIL_SMTP_HOST')) || preset?.host || ''
  const port = Number(await envValue('MAIL_SMTP_PORT')) || preset?.port || 465
  return { user, pass, host, port, secure: port === 465, ok: !!(user && pass && host) }
}

const EMAIL = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/

export function parseMejl(args: string): { to: string | null; subject: string; body: string } | null {
  let rest = args.trim()
  let to: string | null = null
  const first = rest.split(/\s+/)[0]
  if (EMAIL.test(first)) { to = first; rest = rest.slice(first.length).trim() }
  if (!rest) return null
  // předmět - zpráva · předmět | zpráva · předmět na 1. řádku, zpráva pod ním
  const m = rest.match(/^(.+?)\s+[-–—|]\s+([\s\S]+)$/) ?? rest.match(/^(.+?)\n([\s\S]+)$/)
  return m ? { to, subject: m[1].trim(), body: m[2].trim() } : { to, subject: rest.slice(0, 80), body: rest }
}

export async function mejlCommand(args: string): Promise<CommandResult> {
  const steps = ['Mary Jane: /mejl']
  const parsed = parseMejl(args)
  if (!parsed) {
    return {
      reply: [
        'Jak na to:',
        '/mejl Předmět - text zprávy   → pošle tobě (připomínka do mailu)',
        '/mejl kamarad@seznam.cz Předmět - text   → komukoli',
        'Před odesláním vždy ukážu náhled a počkám na ✅.',
      ].join('\n'),
      steps,
    }
  }
  const cfg = await smtpConfig()
  if (!cfg.ok) return { reply: '📧 Odesílání potřebuje stejné údaje jako Luuu (LUUU_IMAP_USER, LUUU_IMAP_PASS v .env).', steps }
  const to = parsed.to ?? cfg.user
  const preview = [
    `📧 Odeslat e-mail?`,
    `Od: ${cfg.user}`,
    `Komu: ${to}${parsed.to ? '' : ' (tobě)'}`,
    `Předmět: ${parsed.subject}`,
    '',
    parsed.body.length > 1200 ? `${parsed.body.slice(0, 1200)}…` : parsed.body,
  ].join('\n')
  return {
    reply: askConfirm(preview, `odeslat e-mail na ${to}`, async () => {
      const t = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass: cfg.pass } })
      const info = await t.sendMail({ from: cfg.user, to, subject: parsed.subject, text: parsed.body })
      await logActivity({ agent: 'Mary Jane', type: 'system', action: `📧 odeslán e-mail → ${to}: ${parsed.subject.slice(0, 60)}`, meta: { to, messageId: info.messageId } }).catch(() => {})
      return `📧 Odesláno → ${to}\nPředmět: ${parsed.subject}`
    }),
    steps,
  }
}

/** Ověří přihlášení k SMTP bez odeslání čehokoli (pro test). */
export async function verifySmtp(): Promise<string> {
  const cfg = await smtpConfig()
  if (!cfg.ok) return 'chybí údaje'
  const t = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass: cfg.pass } })
  await t.verify()
  return `OK (${cfg.host}:${cfg.port})`
}
