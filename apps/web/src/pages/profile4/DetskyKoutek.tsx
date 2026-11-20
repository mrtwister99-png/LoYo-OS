// apps/web/src/pages/profile4/DetskyKoutek.tsx
// Profil 4 (GRAFIK) → Dětský koutek. Ukázkové okno se složkou „M" = Matrix digital rain.
// Levý panel = ovládání (start/stop, směr, hustota, velikost), pravý panel = vzhled a efekty.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  DEFAULT_MATRIX_CONFIG,
  GLYPHS,
  MatrixRainEngine,
  type MatrixConfig,
  type MatrixCursorEffect,
  type MatrixDirection,
  type MatrixPattern,
} from './matrixEngine'

const PATTERNS: { value: MatrixPattern; label: string }[] = [
  { value: 'matrix', label: 'MATRIX ZNAKY' },
  { value: 'squares', label: 'ČTVEREČKY' },
  { value: 'circles', label: 'KOLEČKA' },
  { value: 'stars', label: 'HVĚZDIČKY' },
]

const CURSOR_EFFECTS: { value: MatrixCursorEffect; label: string }[] = [
  { value: 'color', label: 'ZMĚNA BARVY (ŽLUTOLENÁ)' },
  { value: 'sparks', label: 'BARVA + JISKRY' },
  { value: 'none', label: 'ŽÁDNÝ' },
]

const DIRECTIONS: { value: MatrixDirection; label: string }[] = [
  { value: 'down', label: 'DOLŮ' },
  { value: 'up', label: 'NAHORU' },
  { value: 'left', label: 'DOLEVA' },
  { value: 'right', label: 'DOPRAVA' },
]

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6c.6 0 1.2.22 1.65.62L12.4 7H18.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"
        fill="#12a4ff"
        opacity="0.9"
      />
    </svg>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1 text-[9px] font-black tracking-[0.24em] text-[#9a9a9a]">{children}</div>
}

function Slider(props: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}) {
  const { label, value, min, max, step, unit, onChange } = props
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[9px] font-black tracking-[0.24em] text-[#9a9a9a]">{label}</span>
        <span className="font-mono text-[10px] text-[#12a4ff]">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="h-4 w-full"
        style={{ accentColor: '#12a4ff' }}
      />
    </div>
  )
}

function ColorRow(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[9px] font-black tracking-[0.24em] text-[#9a9a9a]">{props.label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-[#f0f0f0]/60">{props.value.toUpperCase()}</span>
        <input
          type="color"
          value={props.value}
          onChange={e => props.onChange(e.target.value)}
          className="h-7 w-9 border border-[#444] bg-[#2b2b2b] p-0"
        />
      </div>
    </div>
  )
}

export default function DetskyKoutek() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<MatrixRainEngine | null>(null)
  const [cfg, setCfg] = useState<MatrixConfig>(DEFAULT_MATRIX_CONFIG)
  const [running, setRunning] = useState(true)
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)

  function patch<K extends keyof MatrixConfig>(key: K, value: MatrixConfig[K]) {
    setCfg(prev => ({ ...prev, [key]: value }))
  }

  // engine žije mimo React – konfigurace se do něj jen propisuje
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = new MatrixRainEngine(canvas, DEFAULT_MATRIX_CONFIG)
    engineRef.current = engine
    return () => {
      engine.destroy()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    engineRef.current?.setConfig(cfg)
  }, [cfg])

  useEffect(() => {
    if (running) engineRef.current?.play()
    else engineRef.current?.stop()
  }, [running])

  const bgGradient = useMemo(
    () => `linear-gradient(165deg, ${cfg.bg} 0%, ${cfg.bg} 35%, ${cfg.bg2} 100%)`,
    [cfg.bg, cfg.bg2],
  )

  const glyphCount = GLYPHS[cfg.pattern]?.length ?? 0

  return (
    <div className="min-h-full bg-[#2b2b2b] p-4 md:p-6">
      <div className="mx-auto w-full max-w-[1180px]">
        <div className="overflow-hidden rounded-[16px] border border-[#444] bg-[#353535] shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          {/* horní lišta okna */}
          <div className="flex h-10 items-center justify-between gap-3 border-b border-[#444] bg-[#3a3a3a] px-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="live-dot" />
              <span className="truncate text-[10px] font-black tracking-[0.3em] text-[#f0f0f0]">DĚTSKÝ KOUTEK</span>
              <span className="hidden truncate font-mono text-[10px] text-[#9a9a9a] sm:inline">/ M • MATRIX RAIN</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLeftOpen(o => !o)}
                className="border px-2.5 py-1 text-[9px] font-black tracking-[0.2em] transition-colors"
                style={{
                  borderColor: leftOpen ? '#12a4ff' : '#444',
                  background: leftOpen ? '#12a4ff' : '#2b2b2b',
                  color: leftOpen ? '#ffffff' : '#9a9a9a',
                }}
              >
                ◧ OVLÁDÁNÍ
              </button>
              <button
                onClick={() => setRightOpen(o => !o)}
                className="border px-2.5 py-1 text-[9px] font-black tracking-[0.2em] transition-colors"
                style={{
                  borderColor: rightOpen ? '#12a4ff' : '#444',
                  background: rightOpen ? '#12a4ff' : '#2b2b2b',
                  color: rightOpen ? '#ffffff' : '#9a9a9a',
                }}
              >
                NASTAVENÍ ◨
              </button>
            </div>
          </div>

          {/* složky = hry */}
          <div className="flex items-end gap-2 border-b border-[#444] bg-[#2f2f2f] px-2 pt-2">
            <div className="-mb-px flex h-9 items-center gap-2 rounded-t-[9px] border border-[#444] border-b-transparent bg-[#353535] px-4 text-[11px] font-black tracking-[0.2em] text-[#f0f0f0]">
              <FolderIcon />
              M
            </div>
            <span className="pb-2 pl-1 text-[10px] font-bold tracking-[0.2em] text-[#9a9a9a] opacity-70">HRY / 01</span>
          </div>

          {/* plocha hry */}
          <div
            className="relative overflow-hidden"
            style={{ height: 'min(70vh, 620px)', background: bgGradient }}
          >
            <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />

            {/* LEVÝ PANEL – ovládání */}
            <div
              className="absolute inset-y-0 left-0 z-20 w-[248px] transition-transform duration-300"
              style={{ transform: leftOpen ? 'translateX(0)' : 'translateX(-105%)' }}
            >
              <div className="h-full space-y-4 overflow-y-auto border-r border-[#444] bg-[#2b2b2b]/95 p-3 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black tracking-[0.28em] text-[#12a4ff]">OVLÁDÁNÍ</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full border px-2 py-0.5 font-mono text-[9px]"
                      style={{
                        borderColor: running ? '#12a4ff' : '#444',
                        color: running ? '#12a4ff' : '#9a9a9a',
                      }}
                    >
                      {running ? 'RUN' : 'STOP'}
                    </span>
                    <button onClick={() => setLeftOpen(false)} className="px-1 text-[11px] text-[#9a9a9a] hover:text-[#f0f0f0]">
                      ✕
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      engineRef.current?.play()
                      setRunning(true)
                    }}
                    className="border py-2 text-[10px] font-black tracking-[0.2em] transition-colors"
                    style={{
                      borderColor: running ? '#12a4ff' : '#444',
                      background: running ? '#12a4ff' : '#3a3a3a',
                      color: running ? '#ffffff' : '#f0f0f0',
                    }}
                  >
                    START
                  </button>
                  <button
                    onClick={() => setRunning(false)}
                    className="border py-2 text-[10px] font-black tracking-[0.2em] transition-colors"
                    style={{
                      borderColor: !running ? '#ff1e00' : '#444',
                      background: !running ? '#ff1e00' : '#3a3a3a',
                      color: '#ffffff',
                    }}
                  >
                    STOP
                  </button>
                </div>

                <div>
                  <Label>SMĚR</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {DIRECTIONS.map(d => (
                      <button
                        key={d.value}
                        onClick={() => patch('direction', d.value)}
                        className="border py-1.5 text-[9px] font-black tracking-[0.16em] transition-colors"
                        style={{
                          borderColor: cfg.direction === d.value ? '#12a4ff' : '#444',
                          background: cfg.direction === d.value ? '#12a4ff' : '#3a3a3a',
                          color: cfg.direction === d.value ? '#ffffff' : '#9a9a9a',
                        }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Slider
                  label="HUSTOTA"
                  value={Math.round(cfg.density * 100)}
                  min={5}
                  max={100}
                  step={5}
                  unit=" %"
                  onChange={v => patch('density', v / 100)}
                />

                <Slider
                  label="VELIKOST ZNAKU"
                  value={cfg.fontSize}
                  min={8}
                  max={40}
                  step={1}
                  unit=" px"
                  onChange={v => patch('fontSize', v)}
                />

                <Slider
                  label="DÉLKA KAPEK"
                  value={cfg.dropLength}
                  min={2}
                  max={40}
                  step={1}
                  unit=" zn"
                  onChange={v => patch('dropLength', v)}
                />

                <div className="border-t border-[#444] pt-3 font-mono text-[9px] leading-relaxed text-[#9a9a9a]">
                  <div className="flex justify-between">
                    <span>KAPKY</span>
                    <span className="text-[#f0f0f0]">{(cfg.density * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ZNAKY</span>
                    <span className="text-[#f0f0f0]">{glyphCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>KONEC</span>
                    <span className="text-[#f0f0f0]">80–110 %</span>
                  </div>
                </div>
              </div>
            </div>

            {/* PRAVÝ PANEL – vzhled */}
            <div
              className="absolute inset-y-0 right-0 z-20 w-[248px] transition-transform duration-300"
              style={{ transform: rightOpen ? 'translateX(0)' : 'translateX(105%)' }}
            >
              <div className="h-full space-y-4 overflow-y-auto border-l border-[#444] bg-[#2b2b2b]/95 p-3 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black tracking-[0.28em] text-[#12a4ff]">NASTAVENÍ</span>
                  <button onClick={() => setRightOpen(false)} className="px-1 text-[11px] text-[#9a9a9a] hover:text-[#f0f0f0]">
                    ✕
                  </button>
                </div>

                <div className="space-y-2">
                  <ColorRow label="BARVA BG 1" value={cfg.bg} onChange={v => patch('bg', v)} />
                  <ColorRow label="BARVA BG 2" value={cfg.bg2} onChange={v => patch('bg2', v)} />
                  <ColorRow label="BARVA SLOUPECKŮ" value={cfg.column} onChange={v => patch('column', v)} />
                  <ColorRow label="BARVA HLAVIČKY" value={cfg.head} onChange={v => patch('head', v)} />
                  <ColorRow label="BARVA STŘETU" value={cfg.cursor} onChange={v => patch('cursor', v)} />
                </div>

                <div className="border-t border-[#444] pt-3">
                  <Label>VZOR KAPEK</Label>
                  <select
                    value={cfg.pattern}
                    onChange={e => patch('pattern', e.target.value as MatrixPattern)}
                    className="w-full border border-[#444] bg-[#3a3a3a] px-2 py-1.5 text-[10px] font-black tracking-[0.14em] text-[#f0f0f0]"
                  >
                    {PATTERNS.map(p => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <Slider
                  label="RYCHLOST ZMĚNY ZNAKŮ"
                  value={cfg.charSpeed}
                  min={1}
                  max={30}
                  step={1}
                  unit=" /s"
                  onChange={v => patch('charSpeed', v)}
                />

                <div className="border-t border-[#444] pt-3">
                  <Label>EFEKT PŘI STŘETU S KURZOREM</Label>
                  <select
                    value={cfg.cursorEffect}
                    onChange={e => patch('cursorEffect', e.target.value as MatrixCursorEffect)}
                    className="w-full border border-[#444] bg-[#3a3a3a] px-2 py-1.5 text-[10px] font-black tracking-[0.14em] text-[#f0f0f0]"
                  >
                    {CURSOR_EFFECTS.map(c => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 font-mono text-[9px] leading-relaxed text-[#9a9a9a]">
                    Kapka končí na 80–110 % výšky okna, ocas doběhne do 0 znaků, vybuchne malý ohňostroj a kapka
                    startuje znovu ze svého počátku. Déšť běží nepřetržitě až do pauzy.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
