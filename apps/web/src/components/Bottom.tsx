// D:\dev\loyo-os\apps\web\src\components\Bottom.tsx
export default function Bottom() {
  return (
    <footer className="h-[42px] bg-black border-t border-white/20 flex items-center justify-between px-0 shrink-0 z-40 overscroll-none">
      <div className="flex items-center h-full">
        <div className="flex items-center gap-3 px-5 h-full text-[12px] font-bold tracking-wide text-white font-mono">
          <span>Agenti = 5</span>
          <span className="opacity-20">|</span>
          <span>Teamy = 4</span>
          <span className="opacity-20">|</span>
          <span>Workflows = 3</span>
        </div>
      </div>
      <div className="w-0 h-full shrink-0" />
    </footer>
  )
}
