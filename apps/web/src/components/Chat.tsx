// D:\dev\loyo-os\apps\web\src\components\Chat.tsx
import { useState, useEffect, useRef } from 'react'

type ChatMsg = { from: 'me' | 'mary'; text: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  onUnreadMessage?: () => void
  onSaved?: () => void
  chatLeftOffset?: string
}

export default function Chat({ isOpen, onClose, onUnreadMessage, onSaved, chatLeftOffset = '28%' }: Props): JSX.Element | null {
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

  useEffect(() => {
    const ctx = new AudioContext()
    // vytvoříme krátký "ding" jako data URI
    const sampleRate = ctx.sampleRate
    const duration = 0.15
    const length = sampleRate * duration
    const buffer = ctx.createBuffer(1, length, sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++)
    {
      const t = i / sampleRate
      data[i] = Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 20) * 0.3
    }

   // uložíme jako reusable funkci
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
    }
    catch {}
  }

  // drží vždy aktuální hodnotu isOpen i uvnitř již běžících async volání
  // (closure v sendChatMessage by jinak četl starou hodnotu z okamžiku odeslání zprávy)
  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  // zavření na klávesu ESC — nezávisle na přesném umístění tlačítka X
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // zavření kliknutím kamkoliv mimo okno chatu — záloha, kdyby X selhalo kvůli overlapu
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onClose()
    }
    // malé zpoždění, ať se hned po otevření nezachytí ten samý klik, který chat otevřel
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [isOpen, onClose])

  // načtení 14denní historie při prvním otevření chatu
  useEffect(() => {
    if (!isOpen || historyLoaded.current) return
    historyLoaded.current = true
    fetch('http://localhost:3001/api/chat/history')
      .then(res => res.json())
      .then(data => {
        if (data.messages?.length) {
          const msgs = data.messages.map((m: any) => ({ from: m.from, text: m.text }))
          setChatMessages(msgs)
          lastMsgCountRef.current = msgs.length
        }
      })
      .catch(() => {})
  }, [isOpen])

  // SSE — push při nové zprávě (nahrazuje polling)
  useEffect(() =>
  {
    const fetchMessages = () =>
    {
      fetch('http://localhost:3001/api/chat/history')
        .then(res => res.json())
        .then(data =>
        {
          if (!data.messages?.length) return
          const msgs: ChatMsg[] = data.messages.map((m: any) => ({ from: m.from, text: m.text }))

          if (msgs.length > lastMsgCountRef.current)
          {
            const newOnes = msgs.slice(lastMsgCountRef.current)
            const hasNewFromMary = newOnes.some(m => m.from === 'mary')

            setChatMessages(msgs)
            lastMsgCountRef.current = msgs.length

            if (hasNewFromMary)
            {
              playNotificationSound()
              if (!isOpenRef.current) onUnreadMessage?.()
            }
          }
        })
        .catch(() => {})
    }

    const es = new EventSource('http://localhost:3001/api/chat/watch')

    es.onmessage = (e) =>
    {
      if (e.data === 'new-message') fetchMessages()
    }

    es.onerror = () =>
    {
      // SSE spadlo — fallback poll každých 10s
      es.close()
      const fallback = setInterval(fetchMessages, 10_000)
      return () => clearInterval(fallback)
    }

    return () => es.close()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // při otevření chatu okamžitě skoč úplně dolů (bez animace), ať vidíš poslední zprávu hned
  useEffect(() => {
    if (isOpen) chatEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [isOpen])

  useEffect(() => {
    if (isOpen) chatInputRef.current?.focus()
  }, [isOpen])

  const sendChatMessage = async () => {
    const trimmed = chatInput.trim()
    if (!trimmed || isChatLoading) return

    const isResearch = /^\/research/i.test(trimmed)
    const isQuickSave = /^\/(note|task)/i.test(trimmed)

    setChatMessages(prev => [...prev, { from: 'me', text: trimmed }])
    setChatInput('')
    setIsChatLoading(true)

    // okamžitá hláška, ať víš, že to jede na pozadí (research trvá déle)
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
      setChatMessages(prev => [...prev, { from: 'mary', text: data.reply }])
      if (isQuickSave) onSaved?.()
      else if (!isOpenRef.current) onUnreadMessage?.()
    } catch {
      setChatMessages(prev => [...prev, { from: 'mary', text: 'Chyba spojení, zkus to znovu.' }])
      if (!isOpenRef.current) onUnreadMessage?.()
    } finally {
      setIsChatLoading(false)
    }
  }

  // ── render ────────────────────────────────────────────────────
  if (!isOpen) return null

  return (
    <div
      ref={boxRef}
      style={{
        position: 'fixed',
        top: 64,
        left: chatLeftOffset,
        right: 0,
        height:        'calc(100vh - 64px)',
        background:    '#1a1a20',
        border:        '1px solid rgba(255,255,255,0.12)',
        borderTop:     'none',
        boxShadow:     '0 24px 64px rgba(0,0,0,0.7)',
        zIndex:        100,
        display:       'flex',
        flexDirection: 'column',
        overflow:      'hidden',
        animation:     'chatSlideDown 0.38s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* ── hlavička ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: 48,
        background: '#111', borderBottom: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Online indikátor */}
          <span style={{
            width: 9, height: 9, borderRadius: '50%',
            background: '#d9ff00',
            display: 'inline-block', flexShrink: 0,
            animation: isChatLoading
              ? 'onlineBlink 0.5s step-start infinite'
              : 'onlinePulse 2.5s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>
            Mary – sekretářka
          </span>
          {isChatLoading && (
            <span style={{
              fontSize: 10, color: '#d9ff00', fontFamily: 'monospace',
              fontWeight: 600, letterSpacing: '0.05em',
              animation: 'onlineBlink 0.8s step-start infinite',
            }}>
              píše…
            </span>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onClose() }}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
        >
          ✕
        </button>
      </div>

      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px 16px',
        display: 'flex', flexDirection: 'column', gap: 10,
        fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5,
      }}>
        {chatMessages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.from === 'me' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '75%', padding: '8px 12px', borderRadius: 10,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              background: msg.from === 'me' ? '#1000a1' : 'rgba(255,255,255,0.08)',
              color: msg.from === 'me' ? '#fff' : 'rgba(255,255,255,0.88)',
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        {isChatLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '8px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)',
              fontSize: 12, fontFamily: 'monospace',
            }}>
              píše…
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <style>{`
        @keyframes chatSlideDown {
          from { opacity: 0; transform: translateY(-18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes onlinePulse {
          0%, 100% { box-shadow: 0 0 6px #d9ff00; opacity: 1; }
          50%       { box-shadow: 0 0 16px #d9ff00; opacity: 0.75; }
        }
        @keyframes onlineBlink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.1)',
        background: '#111', flexShrink: 0,
      }}>
        <input
          ref={chatInputRef}
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
          placeholder="Napiš zprávu…"
          style={{
            flex: 1, background: 'rgba(255,255,255,0.08)', color: '#fff',
            fontSize: 12, fontFamily: 'monospace', padding: '8px 12px',
            borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            outline: 'none',
          }}
        />
        <button
          onClick={sendChatMessage}
          style={{
            background: '#1000a1', color: '#fff', fontSize: 11, fontWeight: 700,
            padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            transition: 'background 0.15s', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#ac0001' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#1000a1' }}
        >
          Odeslat
        </button>
      </div>
    </div>
  )
}
