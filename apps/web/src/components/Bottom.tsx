
// D:\dev\loyo-os\apps\web\src\components\Bottom.tsx - Bottom bar s Chatem vpravo jak Facebook + helpbut.png
import { useState, useEffect, useCallback, useRef } from 'react'
import Chat from './Chat'
import helpbutImg from '../images/helpbut.png'

export default function Bottom() {
  const [chatOpen, setChatOpen] = useState(false)
  const [lastChatMsg, setLastChatMsg] = useState<{ from: 'me' | 'mary'; text: string } | null>(null)
  const [unread, setUnread] = useState(0)
  const seenCountRef = useRef<number | null>(null)   // kolik zpráv je už přečtených (null = historie ještě nenačtena)
  const totalRef = useRef(0)                          // kolik zpráv je celkem
  const chatOpenRef = useRef(false)

  // poslední zpráva + počet nepřečtených od Mary
  const fetchLastChat = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/api/chat/history')
      if (!res.ok) return
      const data = await res.json()
      const msgs: { from: 'me' | 'mary'; text: string }[] = data.messages || []
      totalRef.current = msgs.length
      if (seenCountRef.current === null || seenCountRef.current > msgs.length) seenCountRef.current = msgs.length
      if (chatOpenRef.current) seenCountRef.current = msgs.length
      if (msgs.length > 0) {
        const last = msgs[msgs.length - 1]
        setLastChatMsg({ from: last.from, text: last.text })
      }
      setUnread(msgs.slice(seenCountRef.current).filter(m => m.from === 'mary').length)
    } catch {}
  }, [])

  useEffect(() => {
    fetchLastChat()
    const i = setInterval(fetchLastChat, 8_000)
    return () => clearInterval(i)
  }, [fetchLastChat])

  // otevření i zavření chatu = vše je přečtené
  useEffect(() => {
    chatOpenRef.current = chatOpen
    if (seenCountRef.current === null) return
    seenCountRef.current = totalRef.current
    setUnread(0)
  }, [chatOpen])

  const marqueeText = lastChatMsg ? lastChatMsg.text.replace(/\s+/g, ' ').trim() : ''

  return (
    <>
      {/* Chat panel – nad bottom listou, vpravo, jak Facebook na PC */}
      <div
        className="fixed right-4 bottom-[50px] z-50 w-[360px] h-[480px] bg-white border-[3px] border-black rounded-[18px] shadow-[8px_8px_0px_#000] overflow-hidden"
        style={{ display: chatOpen? 'block' : 'none' }}
      >
        <div className="h-full w-full relative">
          <Chat
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
            docked
            onUnreadMessage={fetchLastChat}
            onSaved={() => {}}
          />
        </div>
      </div>

        <footer className="h-[42px] flex items-center justify-center shrink-0 z-40 overscroll-none relative">
        {/* NOVÁ NÍZKÁ — 32px */}
        <div className="w-[95%] bg-white border-[3px] border-black rounded-[12px] shadow-[4px_4px_0px_0px_black] h-[32px] flex items-center overflow-hidden select-none">
          {/* HELP + counts — zbytek šířky */}
          <div className="flex-1 min-w-0 h-full flex items-center gap-3 px-3 text-[10px] font-bold tracking-wide text-black font-mono">
            <button
              onClick={() => alert('Help – LOYO OS v1.0\nShift+1 = přepnout profil\nShift+2 = notif\nTab = fokus')}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white border-[2px] border-black shadow-[1.5px_1.5px_0px_0px_black] active:shadow-[0px_0px_0px_0px_black] active:translate-x-[1.5px] active:translate-y-[1.5px] transition-all duration-100"
              title="Help – nápověda"
            >
              <img src={helpbutImg} alt="help" className="w-4 h-4 object-contain" onError={(e) => { (e.target as any).style.display='none' }} />
              <span className="text-[10px] font-black tracking-[0.08em] uppercase">HELP</span>
            </button>
            <span className="opacity-20">|</span>
            <span>Agenti = 5</span>
            <span className="opacity-20">|</span>
            <span>Teamy = 4</span>
            <span className="opacity-20">|</span>
            <span>Workflows = 3</span>
          </div>

          <div className="w-px h-4 bg-[#dbdbdb] shrink-0" />

          {/* 80-85% = + — 5.26% */}
          <div className="flex-[0_0_5.26%] h-full flex items-center justify-center">
            <button
              aria-label="Add"
              className="w-7 h-7 bg-white border-[2px] border-black rounded-[8px] text-[14px] font-bold leading-none flex items-center justify-center shrink-0 shadow-[1.5px_1.5px_0px_0px_black] active:shadow-[0px_0px_0px_0px_black] active:translate-x-[1.5px] active:translate-y-[1.5px] transition-all duration-100"
            >
              <span className="relative top-[-0.5px]">+</span>
            </button>
          </div>

          <div className="w-px h-4 bg-[#dbdbdb] shrink-0" />

          {/* CHAT — zkrácený: tečka + CHAT: Mary; nová zpráva = běžící text + červené +N */}
          <div className="flex-[0_0_22%] min-w-[200px] h-full flex items-center justify-center px-1.5">
            <style>{`
              @keyframes chatMarquee { from { transform: translateX(0); } to { transform: translateX(-100%); } }
              @keyframes chatBadgePop { 0% { transform: scale(0.4); } 70% { transform: scale(1.25); } 100% { transform: scale(1); } }
            `}</style>
            <button
              onClick={() => setChatOpen(v =>!v)}
              aria-expanded={chatOpen}
              className="bg-black text-white rounded-full flex items-center w-full min-w-0 border-[2px] border-black shadow-[1.5px_1.5px_0px_0px_black] active:shadow-[0.5px_0.5px_0px_0px_black] active:translate-x-[1px] active:translate-y-[1px] transition-all duration-100"
              style={{ height: 24, padding: '0 10px', gap: 6 }}
              title="Chat s Mary"
            >
              <span className="w-1.5 h-1.5 bg-[#00FF88] rounded-full animate-pulse shrink-0" />
              <span className="shrink-0 text-[11px] font-bold tracking-[0.08em] leading-none">CHAT: Mary</span>
              {unread > 0 && marqueeText && (
                <span className="flex-1 min-w-0 overflow-hidden">
                  <span
                    className="inline-block whitespace-nowrap text-[11px] font-medium leading-none"
                    style={{ paddingLeft: '100%', animation: `chatMarquee ${Math.max(10, Math.round((120 + marqueeText.length * 6) / 30))}s linear infinite` }}
                  >{marqueeText}</span>
                </span>
              )}
              {unread > 0 && (
                <span
                  key={unread}
                  className="shrink-0 ml-auto"
                  style={{ background: '#ac0001', color: '#fff', fontSize: 9, fontWeight: 900, lineHeight: 1.2, padding: '2px 6px', borderRadius: 999, animation: 'chatBadgePop 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}
                >+{Math.min(unread, 99)}</span>
              )}
            </button>
          </div>
        </div>
      </footer>
    </>
  )
}
