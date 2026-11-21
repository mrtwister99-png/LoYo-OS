// D:\dev\loyo-os\apps\web\src\components\Chat.tsx - HADR SMALL + DRAGGABLE
import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import LinkifiedText, { openExternal } from './LinkifiedText'

type ChatMsg = { from: 'me' | 'mary'; text: string; meta?: TipMeta | Record<string, any> }

type Tip = {
  title: string
  price: number
  median: number
  discount: number
  portal: string
  url: string
  inBand?: boolean
  slot?: 'main' | 'bonus'
  source?: 'main' | 'watch'
  isNew?: boolean
  watchLabel?: string | null
  profit?: number | null
  profitMargin?: number | null
}

type TipMeta = { kind: 'lopatinka-tips'; report?: string; picks?: Tip[] }

const czk = (v?: number | null) =>
  v == null ? '—' : `${Math.round(v).toLocaleString('cs-CZ').replace(/\u00a0/g, ' ')} Kč`

// Klikací karta tipů Lopatinky v chatu — KOUPENO / IGNOROVAT se zapisuje do decisions.json
// (IGNOROVAT navíc do feedback.json, takže se nabídka už nepošle).
function TipCard({ meta }: { meta: TipMeta }) {
  const [decided, setDecided] = useState<Record<string, 'bought' | 'ignored'>>({})
  const [error, setError] = useState('')
  const picks = meta.picks ?? []

  const decide = async (tip: Tip, action: 'bought' | 'ignored') => {
    setError('')
    try {
      const res = await fetch('http://localhost:3001/api/agents/lopatinka/tips/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, url: tip.url, title: tip.title, price: tip.price }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDecided(prev => ({ ...prev, [tip.url]: action }))
    } catch {
      setError('Rozhodnutí se nepodařilo zapsat — běží API na :3001?')
    }
  }

  return (
    <div style={{
      width: '100%', padding: 8, background: '#313131',
      border: '1.1px solid black', boxShadow: '2px 2px 0px black',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', color: '#12a4ff' }}>🛒 LOPATINKA · TIPY</span>
        <span style={{ fontSize: 9, color: '#9a9a9a' }}>{picks.length} nabídek</span>
      </div>
      {picks.length === 0 && <div style={{ fontSize: 10, color: '#9a9a9a' }}>Dnes nic rozumného.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {picks.map((tip, i) => {
          const state = decided[tip.url]
          const metaLine = [
            tip.portal,
            tip.source === 'watch' ? `🔔 ${tip.watchLabel ?? 'hlídané'}${tip.isNew ? ' · NOVÉ' : ''}` : '',
            tip.slot === 'bonus' ? 'bonus mimo pásmo' : tip.inBand === false ? 'mimo pásmo' : '',
            tip.discount > 0 ? `−${tip.discount} % vs. medián` : tip.discount < 0 ? `⚠️ +${Math.abs(tip.discount)} % nad mediánem` : '',
            tip.profit != null ? `zisk ~${czk(tip.profit)}` : '',
          ].filter(Boolean).join(' · ')
          return (
            <div key={`${tip.url}-${i}`} style={{ padding: 6, background: '#3a3a3a', border: '1px solid #444' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'baseline' }}>
                <span style={{ fontSize: 10, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {i + 1}) {tip.title}
                </span>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#12a4ff', flexShrink: 0 }}>{czk(tip.price)}</span>
              </div>
              <div style={{ fontSize: 9, color: '#9a9a9a', marginTop: 2 }}>{metaLine}</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                <a
                  href={tip.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => { e.preventDefault(); openExternal(tip.url) }}
                  style={{ padding: '2px 6px', fontSize: 9, fontWeight: 700, color: '#f0f0f0', background: '#444', border: '1px solid black', textDecoration: 'none' }}
                >OTEVŘÍT</a>
                <button
                  onClick={() => decide(tip, 'bought')}
                  disabled={!!state}
                  style={{ padding: '2px 6px', fontSize: 9, fontWeight: 900, cursor: state ? 'default' : 'pointer', background: state === 'bought' ? '#1f9d55' : '#444', color: '#f0f0f0', border: '1px solid black', opacity: state && state !== 'bought' ? 0.5 : 1 }}
                >{state === 'bought' ? '✓ KOUPENO' : 'KOUPENO'}</button>
                <button
                  onClick={() => decide(tip, 'ignored')}
                  disabled={!!state}
                  style={{ padding: '2px 6px', fontSize: 9, fontWeight: 900, cursor: state ? 'default' : 'pointer', background: state === 'ignored' ? '#8a3b3b' : '#444', color: '#f0f0f0', border: '1px solid black', opacity: state && state !== 'ignored' ? 0.5 : 1 }}
                >{state === 'ignored' ? '✓ IGNOROVÁNO' : 'IGNOROVAT'}</button>
              </div>
            </div>
          )
        })}
      </div>
      {error && <div style={{ fontSize: 9, color: '#ff6b6b', marginTop: 4 }}>{error}</div>}
      {meta.report && (
        <div style={{ fontSize: 9, color: '#9a9a9a', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Report: {String(meta.report).split(/[\\/]/).pop()}
        </div>
      )}
    </div>
  )
}

type Props = {
  isOpen: boolean
  onClose: () => void
  onUnreadMessage?: () => void
  onSaved?: () => void
  chatLeftOffset?: string
  docked?: boolean   // true = vložený do panelu (bez drag/resize, jen minimalizace)
}

export default function Chat({ isOpen, onClose, onUnreadMessage, onSaved, docked = false }: Props): JSX.Element | null {
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    { from: 'mary', text: 'Ahoj, jsem Mary. S čím ti mám pomoct?' },
  ])
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const chatInputRef = useRef<HTMLInputElement | null>(null)
  const historyLoaded = useRef(false)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const isOpenRef = useRef(isOpen)
  const lastMsgCountRef = useRef(0)
  type AudioCtxData = { ctx: AudioContext; buffer: AudioBuffer } | null
  const audioCtxRef = useRef<AudioCtxData>(null)

  // --- DRAGGABLE + SMALL ---
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [size, setSize] = useState({ w: 440, h: 580 })
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 })
  const resizeRef = useRef({ resizing: false, startX: 0, startY: 0, origW: 0, origH: 0 })

  // --- PICKER (↑↓ + Enter) ---
  type PickerState = { type: string; items: any[]; tmpPath: string } | null
  const [picker, setPicker] = useState<PickerState>(null)
  const [pickerIdx, setPickerIdx] = useState(0)

  // příkazy Mary pro našeptávač (GET /api/commands = commands.json)
  const [cmdList, setCmdList] = useState<{ name: string; description: string; args?: { value: string; desc: string }[] }[]>([])
  const [cmdIdx, setCmdIdx] = useState(0)
  useEffect(() => {
    if (!isOpen || cmdList.length) return
    fetch('http://localhost:3001/api/commands')
      .then(r => r.json())
      .then(j => setCmdList(Array.isArray(j.commands) ? j.commands.filter((c: any) => c.enabled !== false) : []))
      .catch(() => {})
  }, [isOpen, cmdList.length])
  // 1) „/ne“ → příkazy   2) „/new “ → jeho možnosti (agent, team, …) z commands.json → args
  type Suggestion = { key: string; label: string; description: string; fill: string }
  const cmdSuggestions: Suggestion[] = (() => {
    if (/^\/\S*$/.test(chatInput)) {
      const typed = chatInput.toLowerCase()
      return cmdList.filter(c => c.name.toLowerCase().startsWith(typed)).slice(0, 8)
        .map(c => ({ key: c.name, label: c.name, description: c.description, fill: `${c.name} ` }))
    }
    const m = chatInput.match(/^(\/\S+)\s+(.*)$/)
    if (!m) return []
    const cmd = cmdList.find(c => c.name.toLowerCase() === m[1].toLowerCase())
    const rest = m[2].toLowerCase()
    if (!cmd?.args?.length) return []
    return cmd.args
      .filter(a => a.value.toLowerCase().startsWith(rest) && a.value.toLowerCase() !== rest.trim())
      .slice(0, 8)
      .map(a => ({ key: `${cmd.name} ${a.value}`, label: a.value, description: a.desc, fill: `${cmd.name} ${a.value} ` }))
  })()

  // init pos bottom-right small
  useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window.innerWidth
    const h = window.innerHeight
    const initW = 440
    const initH = 580
    setSize({ w: initW, h: initH })
    setPos({ x: w - initW - 24, y: h - initH - 24 })
  }, [])

  // load pos/size from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('loyo-chat-pos-size')
      if (saved) {
        const p = JSON.parse(saved)
        if (p.x != null && p.y != null) setPos({ x: p.x, y: p.y })
        if (p.w && p.h) setSize({ w: Math.max(320, Math.min(600, p.w)), h: Math.max(360, Math.min(800, p.h)) })
      }
    } catch {}
  }, [])

  // save pos/size
  useEffect(() => {
    try { localStorage.setItem('loyo-chat-pos-size', JSON.stringify({ ...pos, ...size })) } catch {}
  }, [pos, size])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current.dragging) {
        const dx = e.clientX - dragRef.current.startX
        const dy = e.clientY - dragRef.current.startY
        let nx = dragRef.current.origX + dx
        let ny = dragRef.current.origY + dy
        // clamp to viewport
        const vw = window.innerWidth
        const vh = window.innerHeight
        nx = Math.max(8, Math.min(vw - size.w - 8, nx))
        ny = Math.max(8, Math.min(vh - 48, ny))
        setPos({ x: nx, y: ny })
      }
      if (resizeRef.current.resizing) {
        const dx = e.clientX - resizeRef.current.startX
        const dy = e.clientY - resizeRef.current.startY
        let nw = resizeRef.current.origW + dx
        let nh = resizeRef.current.origH + dy
        nw = Math.max(320, Math.min(600, nw))
        nh = Math.max(360, Math.min(800, nh))
        setSize({ w: nw, h: nh })
      }
    }
    const onUp = () => {
      dragRef.current.dragging = false
      resizeRef.current.resizing = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [size.w, size.h])

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    dragRef.current.dragging = true
    dragRef.current.startX = e.clientX
    dragRef.current.startY = e.clientY
    dragRef.current.origX = pos.x
    dragRef.current.origY = pos.y
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
  }

  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    resizeRef.current.resizing = true
    resizeRef.current.startX = e.clientX
    resizeRef.current.startY = e.clientY
    resizeRef.current.origW = size.w
    resizeRef.current.origH = size.h
    document.body.style.cursor = 'nwse-resize'
    document.body.style.userSelect = 'none'
  }

  // --- AUDIO DING ---
  useEffect(() => {
    const ctx = new AudioContext()
    const sampleRate = ctx.sampleRate
    const duration = 0.15
    const length = sampleRate * duration
    const buffer = ctx.createBuffer(1, length, sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate
      data[i] = Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 20) * 0.3
    }
    audioCtxRef.current = { ctx, buffer }
    return () => { ctx.close().catch(() => {}) }
  }, [])

  const playNotificationSound = () => {
    try {
      const audioData = audioCtxRef.current
      if (!audioData) return
      const { ctx, buffer } = audioData
      if (!ctx || !buffer) return
      if (ctx.state === 'suspended') ctx.resume()
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start()
    } catch {}
  }

  useEffect(() => { isOpenRef.current = isOpen }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // klik mimo už nedělá close když je draggable - zavírá se jen X a ESC
  // (dřív to zavíralo při kliku mimo, teď je to malé okno, takže nechceme)

  useEffect(() => {
    if (!isOpen || historyLoaded.current) return
    historyLoaded.current = true
    fetch('http://localhost:3001/api/chat/history')
      .then(res => res.json())
      .then(data => {
        if (data.messages?.length) {
          const msgs = data.messages.map((m: any) => ({ from: m.from, text: m.text, meta: m.meta }))
          setChatMessages(msgs)
          lastMsgCountRef.current = msgs.length
        }
      })
      .catch(() => {})
  }, [isOpen])

  useEffect(() => {
    const fetchMessages = () => {
      fetch('http://localhost:3001/api/chat/history')
        .then(res => res.json())
        .then(data => {
          if (!data.messages?.length) return
          const msgs: ChatMsg[] = data.messages.map((m: any) => ({ from: m.from, text: m.text, meta: m.meta }))
          if (msgs.length > lastMsgCountRef.current) {
            const newOnes = msgs.slice(lastMsgCountRef.current)
            const hasNewFromMary = newOnes.some(m => m.from === 'mary')
            setChatMessages(msgs)
            lastMsgCountRef.current = msgs.length
            if (hasNewFromMary) {
              playNotificationSound()
              if (!isOpenRef.current) onUnreadMessage?.()
            }
          }
        })
        .catch(() => {})
    }
    const es = new EventSource('http://localhost:3001/api/chat/watch')
    es.onmessage = (e) => { if (e.data === 'new-message') fetchMessages() }
    es.onerror = () => {
      es.close()
      const fallback = setInterval(fetchMessages, 10_000)
      return () => clearInterval(fallback)
    }
    return () => es.close()
  }, [])

  // stránkování: drží se posledních 50, po odjetí nahoru +50, nejvýš 200
  const PAGE = 50
  const MAX_SHOWN = 200
  const [visibleCount, setVisibleCount] = useState(PAGE)
  const listRef = useRef<HTMLDivElement | null>(null)
  const prevScrollHeight = useRef<number | null>(null)
  const shownMessages = chatMessages.slice(-Math.min(visibleCount, MAX_SHOWN))
  const shownOffset = chatMessages.length - shownMessages.length
  const onListScroll = () => {
    const el = listRef.current
    if (!el || el.scrollTop > 30) return
    if (visibleCount >= MAX_SHOWN || visibleCount >= chatMessages.length) return
    prevScrollHeight.current = el.scrollHeight
    setVisibleCount(v => Math.min(MAX_SHOWN, v + PAGE))
  }
  // po načtení starších zpráv drž pozici (obsah přibyl nahoře)
  useLayoutEffect(() => {
    const el = listRef.current
    if (el && prevScrollHeight.current != null) {
      el.scrollTop = el.scrollHeight - prevScrollHeight.current
      prevScrollHeight.current = null
    }
  }, [visibleCount])
  // nová zpráva / znovuotevření → zpátky na posledních 50
  useEffect(() => { setVisibleCount(PAGE) }, [chatMessages.length, isOpen])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])
  useEffect(() => { if (isOpen) chatEndRef.current?.scrollIntoView({ behavior: 'auto' }) }, [isOpen])
  useEffect(() => { if (isOpen) chatInputRef.current?.focus() }, [isOpen])

  const sendWithValue = async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed || isChatLoading) return
    const isResearch = /^\/research/i.test(trimmed)
    const isQuickSave = /^\/(note|task)/i.test(trimmed)
    setChatMessages(prev => [...prev, { from: 'me', text: trimmed }])
    setChatInput('')
    setIsChatLoading(true)
    setPicker(null)
    if (isResearch) {
      setChatMessages(prev => [...prev, { from: 'mary', text: 'Jasně Tome, přeposílám a dám vědět, jak bude výsledek. 🚀' }])
    }
    try {
      const res = await fetch('http://localhost:3001/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })
      const data = await res.json()
      let displayText = data.reply as string
      const builderMatch = displayText.match(/OPEN_BUILDER:([^:]+):([^:]+):?([^\n]*)?/)
      if (builderMatch) {
        const [, bType, bId, bExtra] = builderMatch
        window.dispatchEvent(new CustomEvent('loyo:open-builder', { detail: { type: bType, id: bId, extra: bExtra, raw: data.reply } }))
        displayText = displayText.replace(/OPEN_BUILDER:[^\n]*\n?/, '').trim()
      }
      const pickerMatch = (data.reply as string).match(/PICKER:([^:]+):([^\n]+)/)
      if (pickerMatch) {
        const [, pType, pPath] = pickerMatch
        try {
          const r = await fetch(`http://localhost:3001/api/tmp?path=${encodeURIComponent(pPath)}`)
          const j = await r.json()
          let items: any[] = j.items || j.agents || []
          if (j.types) items = j.types.map((t: string) => ({ number: t, id: t, displayName: t }))
          if (!items.length && Array.isArray(j)) items = j
          setPicker({ type: pType, items, tmpPath: pPath })
          setPickerIdx(0)
          displayText = displayText.replace(/PICKER:[^\n]*\n?/, '').trim()
          if (!displayText) displayText = `Vyber ${pType} — ↑↓ + Enter nebo klik`
        } catch {}
      }
      setChatMessages(prev => [...prev, { from: 'mary', text: displayText }])
      if (isQuickSave) onSaved?.()
      else if (!isOpenRef.current) onUnreadMessage?.()
    } catch {
      setChatMessages(prev => [...prev, { from: 'mary', text: 'Chyba spojení, zkus to znovu.' }])
      if (!isOpenRef.current) onUnreadMessage?.()
    } finally {
      setIsChatLoading(false)
    }
  }

  const sendChatMessage = async () => {
    await sendWithValue(chatInput)
  }

  if (!isOpen) return null

  return (
    <div
      ref={boxRef}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      style={{
        ...(docked
          ? { position: 'relative' as const, width: '100%', height: '100%', border: 'none', boxShadow: 'none' }
          : { position: 'fixed' as const, left: pos.x, top: pos.y, width: size.w, height: size.h, border: '1px solid black', boxShadow: '6px 6px 0px black', zIndex: 100 }),
        background: '#3a3a3a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'chatSlideDown 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* hlavička - DRAGGABLE */}
      <div
        onMouseDown={docked ? undefined : onHeaderMouseDown}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 10px', height: 38,
          background: '#444', borderBottom: '1px solid black',
          flexShrink: 0,
          cursor: docked ? 'default' : 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!docked && <span style={{ fontSize: 12, cursor: 'grab' }}>⠿</span>}
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#12a4ff',
            display: 'inline-block',
            animation: isChatLoading ? 'onlineBlink 0.5s step-start infinite' : 'onlinePulse 2.5s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.05em' }}>
            Mary{docked? '' : ` • ${size.w}x${size.h}`}
          </span>
          {isChatLoading && <span style={{ fontSize: 10, color: '#9a9a9a', fontWeight: 700, animation: 'onlineBlink 0.8s step-start infinite' }}>píše…</span>}
        </div>
        {docked ? (
          <button
            onClick={e => { e.stopPropagation(); onClose() }}
            title="Minimalizovat"
            style={{
              width: 28, height: 22, border: '1.1px solid black',
              background: '#3a3a3a', color: '#f0f0f0', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 900, lineHeight: 1,
              boxShadow: '1.5px 1.5px 0px black',
            }}
          >
            –
          </button>
        ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => {
              // reset pos
              const w = window.innerWidth
              const h = window.innerHeight
              setPos({ x: w - size.w - 24, y: h - size.h - 24 })
              setSize({ w: 440, h: 580 })
              localStorage.removeItem('loyo-chat-pos-size')
            }}
            title="Reset pozice"
            style={{ width: 24, height: 20, border: '1px solid black', background: '#444', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}
          >
            ⊙
          </button>
          <button
            onClick={e => { e.stopPropagation(); onClose() }}
            style={{
              width: 24, height: 20, border: '1px solid black',
              background: '#444', color: '#f0f0f0', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 900,
            }}
          >
            ✕
          </button>
        </div>
        )}
      </div>

      <div ref={listRef} onScroll={onListScroll} style={{
        flex: 1, overflowY: 'auto', padding: '10px',
        display: 'flex', flexDirection: 'column', gap: 8,
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.4,
        background: '#2b2b2b',
      }}>
        {chatMessages.length > shownMessages.length ? (
          <div style={{ textAlign: 'center', fontSize: 9, color: '#9a9a9a', padding: '2px 0' }}>
            ↑ odjeď nahoru pro dalších {Math.min(PAGE, chatMessages.length - shownMessages.length)} · zobrazeno {shownMessages.length} z {chatMessages.length}
          </div>
        ) : chatMessages.length > MAX_SHOWN ? (
          <div style={{ textAlign: 'center', fontSize: 9, color: '#9a9a9a', padding: '2px 0' }}>— maximum {MAX_SHOWN} zpráv —</div>
        ) : null}
        {shownMessages.map((msg, i) => {
          const tipMeta = msg.meta && (msg.meta as any).kind === 'lopatinka-tips' ? (msg.meta as TipMeta) : null
          if (tipMeta) {
            return (
              <div key={shownOffset + i} style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ maxWidth: '94%', width: '100%' }}>
                  <TipCard meta={tipMeta} />
                </div>
              </div>
            )
          }
          return (
            <div key={shownOffset + i} style={{ display: 'flex', justifyContent: msg.from === 'me' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '82%', padding: '6px 10px', border: '1.1px solid black',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: msg.from === 'me' ? '#12a4ff' : '#3a3a3a',
                color: msg.from === 'me' ? '#f0f0f0' : '#f0f0f0',
                boxShadow: '2px 2px 0px black',
                fontSize: 11,
              }}>
                <LinkifiedText text={msg.text} color={msg.from === 'me' ? '#ffffff' : '#7cc8ff'} />
                {(() => {
                  // Mary čeká na potvrzení → tlačítka místo psaní /ano <kód>
                  const code = msg.from === 'mary' ? msg.text.match(/\/ano ([a-z0-9]{4})\b/)?.[1] : undefined
                  if (!code) return null
                  const answered = chatMessages.some(m => m.from === 'me' && new RegExp(`^/(ano|ne) ${code}\\b`).test(m.text.trim()))
                  if (answered) return <div style={{ marginTop: 6, fontSize: 9, opacity: 0.6 }}>✓ vyřízeno</div>
                  return (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button onClick={() => sendWithValue(`/ano ${code}`)} disabled={isChatLoading}
                        style={{ background: '#facc15', color: '#111', fontWeight: 900, fontSize: 10, padding: '4px 10px', border: '1px solid black', cursor: 'pointer', boxShadow: '2px 2px 0 black' }}>✅ POTVRDIT</button>
                      <button onClick={() => sendWithValue(`/ne ${code}`)} disabled={isChatLoading}
                        style={{ background: '#444', color: '#f0f0f0', fontWeight: 900, fontSize: 10, padding: '4px 10px', border: '1px solid black', cursor: 'pointer', boxShadow: '2px 2px 0 black' }}>❌ ZRUŠIT</button>
                    </div>
                  )
                })()}
              </div>
            </div>
          )
        })}
        {picker && (
          <div style={{ border: '1px solid #12a4ff', background: '#3a3a3a', boxShadow: '3px 3px 0px black', maxHeight: 220, overflowY: 'auto' }}>
            <div style={{ padding: '6px 8px', background: '#12a4ff', color: '#f0f0f0', fontWeight: 900, fontSize: 10 }}>↑↓ vyber • Enter potvrdí • Esc zavře — {picker.type} ({picker.items.length})</div>
            {picker.items.map((it: any, idx: number) => (
              <div key={idx} onClick={() => { const v = it.number || it.id; sendWithValue(v) }} style={{ padding: '5px 8px', cursor: 'pointer', background: idx === pickerIdx? '#444' : '#3a3a3a', borderBottom: '1px solid #444', fontWeight: idx === pickerIdx? 900 : 400 }}>
                <span style={{ opacity: 0.6 }}>[{it.number}]</span> {it.id} {it.displayName && it.displayName!== it.id? `— ${it.displayName}` : ''}
              </div>
            ))}
          </div>
        )}
        {isChatLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '6px 10px', border: '1.1px solid black', background: '#3a3a3a', fontSize: 10 }}>píše…</div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <style>{`
        @keyframes chatSlideDown {
          from { opacity: 0; transform: translateY(-12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes onlinePulse {
          0%, 100% { box-shadow: 0 0 4px #12a4ff; opacity: 1; }
          50%       { box-shadow: 0 0 10px #12a4ff; opacity: 0.8; }
        }
        @keyframes onlineBlink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>

      {/* našeptávač příkazů: napiš „/“ a vyber šipkami, Tab / Enter doplní */}
      {cmdSuggestions.length > 0 && (
        <div style={{ borderTop: '1px solid black', background: '#3a3a3a', maxHeight: 200, overflowY: 'auto', flexShrink: 0 }}>
          {cmdSuggestions.map((c, idx) => (
            <div
              key={c.key}
              onMouseDown={(e) => { e.preventDefault(); setChatInput(c.fill); setCmdIdx(0); chatInputRef.current?.focus() }}
              style={{ padding: '4px 8px', cursor: 'pointer', fontSize: 10, display: 'flex', gap: 8, background: idx === cmdIdx ? '#12a4ff' : 'transparent', color: '#f0f0f0' }}
            >
              <span style={{ fontWeight: 900, minWidth: 92, fontFamily: "'JetBrains Mono', monospace" }}>{c.label}</span>
              <span style={{ opacity: idx === cmdIdx ? 0.95 : 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.description}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px', borderTop: '1px solid black',
        background: '#444', flexShrink: 0,
      }}>
        <input
          ref={chatInputRef}
          value={chatInput}
          onChange={e => { setChatInput(e.target.value); setCmdIdx(0) }}
          onKeyDown={e => {
            if (cmdSuggestions.length > 0 && !picker) {
              const sel = cmdSuggestions[cmdIdx]
              if (e.key === 'ArrowDown') { e.preventDefault(); setCmdIdx(i => Math.min(cmdSuggestions.length - 1, i + 1)); return }
              if (e.key === 'ArrowUp') { e.preventDefault(); setCmdIdx(i => Math.max(0, i - 1)); return }
              if (e.key === 'Escape') { e.preventDefault(); setChatInput(''); return }
              // Tab vždy doplní; Enter doplní, jen když ještě není napsaný celý příkaz
              if (sel && (e.key === 'Tab' || (e.key === 'Enter' && chatInput.trim().toLowerCase() !== sel.fill.trim().toLowerCase()))) {
                e.preventDefault(); setChatInput(sel.fill); setCmdIdx(0); return
              }
            }
            if (picker) {
              if (e.key === 'ArrowUp') { e.preventDefault(); setPickerIdx(i => Math.max(0, i - 1)) }
              if (e.key === 'ArrowDown') { e.preventDefault(); setPickerIdx(i => Math.min(picker.items.length - 1, i + 1)) }
              if (e.key === 'Escape') { e.preventDefault(); setPicker(null) }
              if (e.key === 'Enter' &&!chatInput.trim()) { e.preventDefault(); const sel = picker.items[pickerIdx]; if (sel) { const v = sel.number || sel.id; sendWithValue(v) } return }
            }
            if (e.key === 'Enter') sendChatMessage()
          }}
          placeholder={picker? `Vyber ${picker.type} ↑↓ Enter — nebo piš...` : "Napiš… nebo „/“ pro příkazy (/vse = všechny)"}
          style={{
            flex: 1, background: '#3a3a3a', color: '#f0f0f0',
            fontSize: 11, fontFamily: "'JetBrains Mono', monospace", padding: '6px 8px',
            border: '1.1px solid black', outline: 'none',
          }}
        />
        <button
          onClick={sendChatMessage}
          style={{
            background: '#444', color: '#f0f0f0', fontSize: 10, fontWeight: 900,
            padding: '6px 10px', border: '1.1px solid black', cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          SEND
        </button>
      </div>

      {/* resize handle - přetáhni kam chceš velikost */}
      {!docked && (
      <div
        onMouseDown={onResizeMouseDown}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 18,
          height: 18,
          cursor: 'nwse-resize',
          background: '#444',
          borderLeft: '1.1px solid black',
          borderTop: '1.1px solid black',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 900,
          userSelect: 'none',
        }}
        title="Táhni pro změnu velikosti"
      >
        ⤡
      </div>
      )}
    </div>
  )
}
