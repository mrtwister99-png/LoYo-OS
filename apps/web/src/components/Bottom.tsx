
// D:\dev\loyo-os\apps\web\src\components\Bottom.tsx - Bottom bar s Chatem vpravo jak Facebook + helpbut.png
import { useState } from 'react'
import Chat from './Chat'
import helpbutImg from '../images/helpbut.png'

export default function Bottom() {
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <>
      {/* Chat panel – nad bottom listou, vpravo, jak Facebook na PC */}
      {chatOpen && (
        <div className="fixed right-4 bottom-[50px] z-50 w-[360px] h-[480px] bg-white border-[3px] border-black rounded-[18px] shadow-[8px_8px_0px_#000] overflow-hidden">
          <div className="h-full w-full relative">
            <Chat
              isOpen={chatOpen}
              onClose={() => setChatOpen(false)}
              onUnreadMessage={() => {}}
              onSaved={() => {}}
            />
          </div>
        </div>
      )}

      <footer className="h-[42px] bg-[#EFEFF2] border-t-[3px] border-black flex items-center justify-between px-0 shrink-0 z-40 overscroll-none relative">
        <div className="flex items-center h-full">
          <div className="flex items-center gap-3 px-4 h-full text-[12px] font-bold tracking-wide text-black font-mono">
            <button
              onClick={() => alert('Help – LOYO OS v1.0\nShift+1 = přepnout profil\nShift+2 = notif\nTab = fokus')}
              className="flex items-center gap-2 px-2 py-1 rounded-full bg-white border-[2px] border-black shadow-[3px_3px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_#000] transition-all"
              title="Help – nápověda"
            >
              <img src={helpbutImg} alt="help" className="w-5 h-5 object-contain" onError={(e) => { (e.target as any).style.display='none' }} />
              <span className="text-[11px] font-black tracking-[0.08em] uppercase">HELP</span>
            </button>
            <span className="opacity-20">|</span>
            <span>Agenti = 5</span>
            <span className="opacity-20">|</span>
            <span>Teamy = 4</span>
            <span className="opacity-20">|</span>
            <span>Workflows = 3</span>
          </div>
        </div>

        {/* Chat – permanentně vpravo jak Facebook */}
        <div className="flex items-center gap-2 pr-3 h-full">
          <button
            onClick={() => setChatOpen(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black text-white border-[2px] border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all font-black text-[11px] tracking-[0.08em] uppercase"
            title="Chat – Mary"
          >
            <span className="w-2 h-2 rounded-full bg-[#3dd900] animate-pulse" />
            CHAT
            {chatOpen? ' ▲' : ' ▼'}
          </button>
        </div>
      </footer>
    </>
  )
}
