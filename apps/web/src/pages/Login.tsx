import { useState } from 'react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: napojit na /api/auth/login
    localStorage.setItem('loyo_auth', 'true')
    window.location.reload()
  }

  return (
    <div className="min-h-full bg-[#353535] flex items-center justify-center p-6">
      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex w-14 h-14 bg-[#444] text-[#f0f0f0] items-center justify-center font-black text-xl rounded-[12px]">L</div>
          <div className="mt-4 font-black tracking-[0.2em] text-[14px]">LOYO OS</div>
          <div className="mono text-[10px] tracking-[0.3em] opacity-40 mt-1">PREMIUM • MASTER ACCESS</div>
        </div>

        {/* Card */}
        <div className="bg-[#3a3a3a] rounded-[20px] border border-[#444] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
          <div className="mb-8">
            <h1 className="font-black text-[20px] tracking-tight">Přihlášení</h1>
            <p className="mono text-[11px] text-[#9a9a9a] mt-2">Master • Košťárad Fuckstein</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mono text-[10px] tracking-[0.2em] opacity-50 mb-2 block">EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="lukas@loyo.cz"
                className="w-full px-4 py-3.5 bg-[#353535] border border-[#444] rounded-[10px] text-[13px] outline-none focus:border-[#444] focus:bg-[#3a3a3a] transition"
                required
              />
            </div>

            <div>
              <label className="mono text-[10px] tracking-[0.2em] opacity-50 mb-2 block">HESLO</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 bg-[#353535] border border-[#444] rounded-[10px] text-[13px] outline-none focus:border-[#444] focus:bg-[#3a3a3a] transition"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full mt-2 bg-[#444] text-[#f0f0f0] py-4 rounded-[12px] text-[11px] font-black tracking-[0.2em] hover:bg-[#353535] transition"
            >
              PŘIHLÁSIT SE
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#444] flex justify-between items-center mono text-[10px]">
            <span className="opacity-30">SECURE LOGIN</span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#444] rounded-full animate-pulse"></span> SYSTEM LIVE
            </span>
          </div>
        </div>

        <div className="text-center mt-6 mono text-[10px] opacity-20 tracking-wide">
          LOYO OS v2 • Košťárad Fuckstein • Master Agent
        </div>
      </div>
    </div>
  )
}
