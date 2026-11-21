// apps/web/src/components/LinkifiedText.tsx
// Text zprávy s klikacími odkazy. V Tauri otevře odkaz ve výchozím prohlížeči (plugin shell),
// jinde v nové záložce. Ostatní text zůstává, jak je.
import type { MouseEvent } from 'react'

const URL_RE = /(https?:\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+)/gi
// tečka, čárka, závorka apod. na konci věty nejsou součást odkazu
const TRAILING = /[.,;:!?)\]}'"»“]+$/

export async function openExternal(url: string): Promise<void> {
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
  try {
    if ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__) {
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(href)
      return
    }
  } catch (err) {
    console.warn('[link] shell.open selhal, zkouším window.open', err)
  }
  window.open(href, '_blank', 'noopener,noreferrer')
}

export default function LinkifiedText({ text, color = '#7cc8ff' }: { text: string; color?: string }) {
  const parts: Array<string | { url: string }> = []
  let last = 0
  for (const m of String(text ?? '').matchAll(URL_RE)) {
    let url = m[0]
    const trail = url.match(TRAILING)?.[0] ?? ''
    if (trail) url = url.slice(0, -trail.length)
    const start = m.index ?? 0
    if (start > last) parts.push(text.slice(last, start))
    parts.push({ url })
    last = start + url.length
  }
  if (last < text.length) parts.push(text.slice(last))

  const onClick = (url: string) => (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    openExternal(url)
  }

  return (
    <>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : (
          <a
            key={i}
            href={/^https?:\/\//i.test(p.url) ? p.url : `https://${p.url}`}
            onClick={onClick(p.url)}
            title={`Otevřít ${p.url}`}
            style={{ color, textDecoration: 'underline', cursor: 'pointer', wordBreak: 'break-all' }}
          >
            {p.url}
          </a>
        ),
      )}
    </>
  )
}
