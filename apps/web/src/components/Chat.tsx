// D:\dev\loyo-os\apps\web\src\components\Chat.tsx - HADR SMALL + DRAGGABLE
import { useState, useEffect, useRef } from 'react'

type ChatMsg = { from: 'me' | 'mary'; text: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  onUnreadMessage?: () => void
  onSaved?: () => void
  chatLeftOffset?: string
}

export default function Chat({ isOpen, onClose, onUnreadMessage, onSaved }: Props): JSX.Element | null {
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
          const msgs = data.messages.map((m: any) => ({ from: m.from, text: m.text }))
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
          const msgs: ChatMsg[] = data.messages.map((m: any) => ({ from: m.from, text: m.text }))
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

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])
  useEffect(() => { if (isOpen) chatEndRef.current?.scrollIntoView({ behavior: 'auto' }) }, [isOpen])
  useEffect(() => { if (isOpen) chatInputRef.current?.focus() }, [isOpen])

  const sendChatMessage = async () => {
    const trimmed = chatInput.trim()
    if (!trimmed || isChatLoading) return
    const isResearch = /^\/research/i.test(trimmed)
    const isQuickSave = /^\/(note|task)/i.test(trimmed)
    setChatMessages(prev => [...prev, { from: 'me', text: trimmed }])
    setChatInput('')
    setIsChatLoading(true)
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

  if (!isOpen) return null

  return (
    <div
      ref={boxRef}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        background: '#e1e2e3',
        border: '2px solid black',
        boxShadow: '6px 6px 0px black',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'chatSlideDown 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* hlavička - DRAGGABLE */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 10px', height: 38,
          background: '#dbdbdb', borderBottom: '2px solid black',
          flexShrink: 0,
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, cursor: 'grab' }}>⠿</span>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#040b8d',
            display: 'inline-block',
            animation: isChatLoading ? 'onlineBlink 0.5s step-start infinite' : 'onlinePulse 2.5s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.05em' }}>
            Mary • {size.w}x{size.h}
          </span>
          {isChatLoading && <span style={{ fontSize: 10, color: '#ac0001', fontWeight: 700, animation: 'onlineBlink 0.8s step-start infinite' }}>píše…</span>}
        </div>
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
            style={{ width: 24, height: 20, border: '1px solid black', background: '#CDA24D', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}
          >
            ⊙
          </button>
          <button
            onClick={e => { e.stopPropagation(); onClose() }}
            style={{
              width: 24, height: 20, border: '1px solid black',
              background: '#ac0001', color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 900,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <div style={{
        flex: 1, overflowY: 'auto', padding: '10px',
        display: 'flex', flexDirection: 'column', gap: 8,
        fontFamily: 'monospace', fontSize: 11, lineHeight: 1.4,
        background: '#ededed',
      }}>
        {chatMessages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.from === 'me' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '82%', padding: '6px 10px', border: '1.5px solid black',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              background: msg.from === 'me' ? '#040b8d' : 'white',
              color: msg.from === 'me' ? 'white' : 'black',
              boxShadow: '2px 2px 0px black',
              fontSize: 11,
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        {isChatLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '6px 10px', border: '1.5px solid black', background: 'white', fontSize: 10 }}>píše…</div>
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
          0%, 100% { box-shadow: 0 0 4px #040b8d; opacity: 1; }
          50%       { box-shadow: 0 0 10px #040b8d; opacity: 0.8; }
        }
        @keyframes onlineBlink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px', borderTop: '2px solid black',
        background: '#dbdbdb', flexShrink: 0,
      }}>
        <input
          ref={chatInputRef}
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
          placeholder="Napiš… /note /task /find"
          style={{
            flex: 1, background: 'white', color: 'black',
            fontSize: 11, fontFamily: 'monospace', padding: '6px 8px',
            border: '1.5px solid black', outline: 'none',
          }}
        />
        <button
          onClick={sendChatMessage}
          style={{
            background: 'black', color: '#ededed', fontSize: 10, fontWeight: 900,
            padding: '6px 10px', border: '1.5px solid black', cursor: 'pointer',
            boxShadow: '2px 2px 0px #040b8d',
          }}
        >
          SEND
        </button>
      </div>

      {/* resize handle - přetáhni kam chceš velikost */}
      <div
        onMouseDown={onResizeMouseDown}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 18,
          height: 18,
          cursor: 'nwse-resize',
          background: '#CDA24D',
          borderLeft: '1.5px solid black',
          borderTop: '1.5px solid black',
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
    </div>
  )
}
