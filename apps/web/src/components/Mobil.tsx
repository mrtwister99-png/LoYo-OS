// D:\dev\loyo-os\apps\web\src\components\Mobil.tsx
import { useState, useEffect, useRef } from 'react'
import phone1 from '../images/phone1.png'
import phone2 from '../images/phone2.png'
import phone3 from '../images/phone3.png'

type Props = { open: boolean; setOpen: (v: boolean) => void; focused?: boolean }

export default function Mobil({ open, setOpen, focused }: Props) {
  const [isHovered, setIsHovered] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [renderBig, setRenderBig] = useState(open)
  const timeoutRef = useRef<number | null>(null)

  // reset hover when open changes - fix phone3 zaseknuti
  useEffect(() => {
    if (open) {
      setRenderBig(true)
      setIsClosing(false)
      setIsHovered(false) // pri otevreni vypni hover -> nebude blikat phone3
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleClose = () => {
    if (isClosing) return
    setIsHovered(false) // hned vypni hover - rovnou bude phone1, ne phone3
    setIsClosing(true)
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => {
      setRenderBig(false)
      setIsClosing(false)
      setOpen(false)
      setIsHovered(false) // po zavreni zustane phone1
    }, 360) as unknown as number
  }

  const handleOpen = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    setIsHovered(false)
    setIsClosing(false)
    setOpen(true)
    setRenderBig(true)
  }

  const showPhone3 = (isHovered || !!focused) && !isClosing && !renderBig

  return (
    <>
      {/* MALÝ - 168x126 */}
      {!renderBig && (
        <button
          onClick={handleOpen}
          onMouseEnter={() => { if (!isClosing) setIsHovered(true) }}
          onMouseLeave={() => setIsHovered(false)}
          className="fixed bottom-0 right-0 w-[168px] h-[126px] z-[60] p-0 flex items-center justify-center bg-transparent border-0 outline-none select-none"
          style={{ willChange: 'transform', transform: 'translateZ(0)' }}
          title="Otevřít telefon"
        >
          <img
            src={showPhone3 ? phone3 : phone1}
            alt="Telefon"
            draggable={false}
            className="w-full h-full object-contain pointer-events-none"
            style={{
              imageRendering: 'pixelated',
              background: 'transparent',
              backfaceVisibility: 'hidden',
              transform: 'translateZ(0)',
            }}
          />
        </button>
      )}

      {/* VELKÝ - jediná instance, 340px */}
      {renderBig && (
        <div
          className="fixed bottom-0 right-0 w-[340px] max-w-[90vw] z-[60] bg-transparent origin-bottom-right cursor-pointer select-none"
          style={{
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            transform: 'translateZ(0)',
            animation: isClosing
              ? 'phoneClose 0.36s cubic-bezier(0.6, 0, 0.7, 0) forwards'
              : open
              ? 'phoneOpen 0.42s cubic-bezier(0.34,1.4,0.64,1) forwards'
              : 'none',
          }}
          onClick={handleClose}
          title="Zavřít telefon"
        >
          <img
            src={phone2}
            alt="Telefon velký"
            draggable={false}
            className="w-full h-auto object-contain bg-transparent pointer-events-none"
            style={{
              imageRendering: 'pixelated',
              background: 'transparent',
              backfaceVisibility: 'hidden',
              transform: 'translateZ(0)',
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes phoneOpen {
          0% { transform: translate3d(80px, 30px, 0) scale(0.255); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes phoneClose {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          100% { transform: translate3d(80px, 60px, 0) scale(0.255); }
        }
      `}</style>
    </>
  )
}
