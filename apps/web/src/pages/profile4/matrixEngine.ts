// apps/web/src/pages/profile4/matrixEngine.ts
// Matrix digital rain – vykreslovací engine pro „Dětský koutek" (profil 4 / GRAFIK).
// Čistý canvas 2D bez závislostí. Optimalizace: glyph atlas + drawImage, culling mimo plátno,
// cap na částice, jeden rAF, žádné per-frame alokace v horké smyčce.

export type MatrixDirection = 'down' | 'up' | 'left' | 'right'
export type MatrixPattern = 'matrix' | 'squares' | 'circles' | 'stars'
export type MatrixCursorEffect = 'color' | 'sparks' | 'none'

export type MatrixConfig = {
  bg: string            // barva pozadí – začátek přechodu
  bg2: string           // barva pozadí – konec přechodu
  column: string        // barva sloupečků / těla kapky
  head: string          // barva hlavičky kapky
  cursor: string        // barva při střetu s kurzorem (žlutozelená)
  pattern: MatrixPattern
  charSpeed: number     // změn znaku za sekundu
  cursorEffect: MatrixCursorEffect
  direction: MatrixDirection
  density: number       // 0..1 – podíl zaplněných drah
  fontSize: number      // px
  dropLength: number    // délka kapky ve znacích
}

export const DEFAULT_MATRIX_CONFIG: MatrixConfig = {
  bg: '#d6dbe0',
  bg2: '#9ecdf2',
  column: '#d81f1f',
  head: '#5c0000',
  cursor: '#c6ff00',
  pattern: 'matrix',
  charSpeed: 12,
  cursorEffect: 'color',
  direction: 'down',
  density: 0.6,
  fontSize: 16,
  dropLength: 12,
}

export const GLYPHS: Record<MatrixPattern, string[]> = {
  matrix: 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789:*+-=<>¦'.split(''),
  squares: '▪▫◾◽■□◼◻▰▱▮▯'.split(''),
  circles: '●○◉◎◌◍◦∙⊙⊕⊚'.split(''),
  stars: '★☆✦✧✩✪✫✬✭✮✯✰⋆✶✷✸'.split(''),
}

// kapky končí na těchto procentech výšky (šířky) okna
const END_PCTS = [0.8, 0.85, 0.9, 0.95, 1, 1.05, 1.1]
const MAX_DROPS = 220
const MAX_PARTS = 700

type Drop = {
  track: number
  pos: number        // pozice hlavičky v px podél osy pohybu
  speed: number      // px/s
  endPos: number
  len: number        // počet znaků v ocase
  gap: number        // aktuální délka ocasu v px (po zastavení se zmenšuje k 0)
  state: 0 | 1 | 2   // 0 = jede, 1 = stojí a ocas dobíhá, 2 = hotovo
  glyphs: Uint16Array
  flipIn: number
  blink: number
  delay: number
  hot: number
  respawnIn: number
}

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string }

type Atlas = { canvas: HTMLCanvasElement; cw: number; ch: number; count: number }

function makeAtlas(chars: string[], cellW: number, cellH: number, fontSize: number, color: string, dpr: number): Atlas {
  const cw = Math.max(2, Math.ceil(cellW * dpr))
  const ch = Math.max(2, Math.ceil(cellH * dpr))
  const canvas = document.createElement('canvas')
  canvas.width = cw * chars.length
  canvas.height = ch
  const g = canvas.getContext('2d')
  if (g) {
    g.fillStyle = color
    g.font = `700 ${Math.max(6, fontSize * dpr)}px "JetBrains Mono", "MS Gothic", "Segoe UI Symbol", ui-monospace, monospace`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    for (let i = 0; i < chars.length; i++) {
      g.fillText(chars[i], i * cw + cw / 2, ch / 2 + fontSize * dpr * 0.04)
    }
  }
  return { canvas, cw, ch, count: chars.length }
}

export class MatrixRainEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private cfg: MatrixConfig

  private drops: Drop[] = []
  private parts: Particle[] = []
  private raf = 0
  private lastTs = 0
  private time = 0
  private running = true
  private dirty = true

  private w = 1
  private h = 1
  private dpr = 1
  private cellW = 12
  private cellH = 18
  private axisStep = 18
  private trackStep = 12
  private tracks = 1
  private chars: string[] = GLYPHS.matrix

  private columnAtlas: Atlas | null = null
  private headAtlas: Atlas | null = null
  private whiteAtlas: Atlas | null = null
  private cursorAtlas: Atlas | null = null

  private pointerX = -1e6
  private pointerY = -1e6
  private pointerIn = false
  private hitR2 = 400

  private ro: ResizeObserver | null = null

  constructor(canvas: HTMLCanvasElement, cfg: MatrixConfig) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) throw new Error('Canvas 2D není dostupný')
    this.ctx = ctx
    this.cfg = { ...cfg }
    this.layout()
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerleave', this.onPointerLeave)
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.layout())
      this.ro.observe(canvas)
    }
    this.raf = requestAnimationFrame(this.frame)
  }

  // ── veřejné API ────────────────────────────────────────────────────────────
  setConfig(next: MatrixConfig) {
    const prev = this.cfg
    this.cfg = { ...next }
    const metricsChanged = next.fontSize !== prev.fontSize || next.direction !== prev.direction
    const colorsChanged =
      next.pattern !== prev.pattern || next.column !== prev.column || next.head !== prev.head || next.cursor !== prev.cursor
    if (metricsChanged) {
      this.applyMetrics()
      this.buildAtlases()
      this.resetDrops()
    } else if (colorsChanged) {
      this.buildAtlases()
    }
    if (next.density !== prev.density) this.syncCount()
    if (next.dropLength !== prev.dropLength) this.applyLength()
    this.dirty = true
  }

  play() {
    if (this.allDone()) this.reset()
    this.start()
  }

  start() {
    this.running = true
    this.dirty = true
    this.lastTs = 0
  }

  stop() {
    this.running = false
  }

  reset() {
    this.parts.length = 0
    this.time = 0
    this.resetDrops()
    this.dirty = true
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.ro?.disconnect()
    this.ro = null
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave)
  }

  // ── rozměry / atlas ────────────────────────────────────────────────────────
  private layout() {
    const rect = this.canvas.getBoundingClientRect()
    this.w = Math.max(1, Math.round(rect.width))
    this.h = Math.max(1, Math.round(rect.height))
    this.dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
    this.canvas.width = Math.round(this.w * this.dpr)
    this.canvas.height = Math.round(this.h * this.dpr)
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.applyMetrics()
    this.buildAtlases()
    this.resetDrops()
    this.dirty = true
  }

  private applyMetrics() {
    const fs = Math.max(6, this.cfg.fontSize)
    this.cellW = Math.max(4, fs * 0.72)
    this.cellH = Math.max(6, fs * 1.18)
    const vertical = this.cfg.direction === 'down' || this.cfg.direction === 'up'
    this.axisStep = vertical ? this.cellH : this.cellW
    this.trackStep = vertical ? this.cellW : this.cellH
    this.tracks = Math.max(1, Math.floor((vertical ? this.w : this.h) / this.trackStep))
    this.hitR2 = Math.pow(Math.max(this.cellW, this.cellH) * 0.85, 2)
  }

  private buildAtlases() {
    const chars = GLYPHS[this.cfg.pattern] || GLYPHS.matrix
    this.chars = chars
    this.columnAtlas = makeAtlas(chars, this.cellW, this.cellH, this.cfg.fontSize, this.cfg.column, this.dpr)
    this.headAtlas = makeAtlas(chars, this.cellW, this.cellH, this.cfg.fontSize, this.cfg.head, this.dpr)
    this.whiteAtlas = makeAtlas(chars, this.cellW, this.cellH, this.cfg.fontSize, '#ffffff', this.dpr)
    this.cursorAtlas = makeAtlas(chars, this.cellW, this.cellH, this.cfg.fontSize, this.cfg.cursor, this.dpr)
    // nový vzor = jiný počet znaků → přemapovat indexy
    for (const d of this.drops) {
      for (let i = 0; i < d.glyphs.length; i++) d.glyphs[i] = (Math.random() * chars.length) | 0
    }
  }

  // ── kapky ──────────────────────────────────────────────────────────────────
  private targetCount() {
    return Math.max(2, Math.min(MAX_DROPS, Math.round(this.tracks * Math.max(0.05, this.cfg.density))))
  }

  private resetDrops() {
    this.drops.length = 0
    const n = this.targetCount()
    for (let i = 0; i < n; i++) this.drops.push(this.makeDrop())
  }

  private syncCount() {
    const target = this.targetCount()
    while (this.drops.length > target) this.drops.pop()
    while (this.drops.length < target) this.drops.push(this.makeDrop())
  }

  private makeDrop(): Drop {
    const dir = this.cfg.direction
    const vertical = dir === 'down' || dir === 'up'
    const forward = dir === 'down' || dir === 'right'
    const axisSize = vertical ? this.h : this.w
    const pct = END_PCTS[(Math.random() * END_PCTS.length) | 0]
    const endPos = forward ? axisSize * pct : axisSize * (1 - pct)
    const len = Math.max(2, Math.round(this.cfg.dropLength))
    const back = this.axisStep * (0.6 + Math.random() * 2.6)
    const glyphs = new Uint16Array(len)
    for (let i = 0; i < len; i++) glyphs[i] = (Math.random() * this.chars.length) | 0
    return {
      track: (Math.random() * this.tracks) | 0,
      pos: forward ? -back : axisSize + back,
      speed: Math.max(40, this.cfg.fontSize * (7 + Math.random() * 6)),
      endPos,
      len,
      gap: len * this.axisStep,
      state: 0,
      glyphs,
      flipIn: Math.random() * 0.25,
      blink: Math.random() * Math.PI * 2,
      delay: Math.random() * 1.6,
      hot: 0,
      respawnIn: 0.25 + Math.random() * 0.75,
    }
  }

  // kapka doběhla, ohňostroj vybuchl → po chvíli startuje znovu ze svého počátku (déšť jede napořád)
  private revive(d: Drop) {
    const n = this.makeDrop()
    d.track = n.track
    d.pos = n.pos
    d.speed = n.speed
    d.endPos = n.endPos
    d.len = n.len
    d.gap = n.gap
    d.state = 0
    d.glyphs = n.glyphs
    d.flipIn = n.flipIn
    d.blink = n.blink
    d.delay = n.delay
    d.hot = 0
    d.respawnIn = n.respawnIn
  }

  // změna délky kapek za běhu – zachová existující znaky, jen je doplní/zkrátí
  private applyLength() {
    const len = Math.max(2, Math.round(this.cfg.dropLength))
    for (const d of this.drops) {
      if (d.len === len) continue
      const glyphs = new Uint16Array(len)
      const keep = Math.min(len, d.glyphs.length)
      glyphs.set(d.glyphs.subarray(0, keep))
      for (let i = keep; i < len; i++) glyphs[i] = (Math.random() * this.chars.length) | 0
      d.glyphs = glyphs
      d.len = len
      if (d.state === 0) d.gap = len * this.axisStep
    }
  }

  private allDone() {
    if (!this.drops.length) return true
    for (const d of this.drops) if (d.state !== 2) return false
    return true
  }

  private headXY(d: Drop): { x: number; y: number } {
    const dir = this.cfg.direction
    if (dir === 'down' || dir === 'up') return { x: d.track * this.trackStep + this.cellW / 2, y: d.pos }
    return { x: d.pos, y: d.track * this.trackStep + this.cellH / 2 }
  }

  // ── smyčka ─────────────────────────────────────────────────────────────────
  private frame = (ts: number) => {
    this.raf = requestAnimationFrame(this.frame)
    const dt = this.lastTs ? Math.min(0.05, Math.max(0, (ts - this.lastTs) / 1000)) : 0
    this.lastTs = ts
    if (this.running) {
      this.time += dt
      if (dt > 0) this.update(dt)
    } else if (!this.dirty) {
      return
    }
    this.dirty = false
    this.render()
  }

  private update(dt: number) {
    const dir = this.cfg.direction
    const forward = dir === 'down' || dir === 'right'
    const sign = forward ? 1 : -1
    const cs = Math.max(0.5, this.cfg.charSpeed)

    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i]
      if (d.delay > 0) {
        d.delay -= dt
        continue
      }
      if (d.state === 0) {
        d.pos += sign * d.speed * dt
        if (forward ? d.pos >= d.endPos : d.pos <= d.endPos) {
          d.pos = d.endPos
          d.state = 1
        }
      } else if (d.state === 1) {
        // ocas dobíhá k zastavené hlavičce → 0 znaků → ohňostroj
        d.gap -= d.speed * dt
        if (d.gap <= 0) {
          d.gap = 0
          d.state = 2
          const p = this.headXY(d)
          this.burst(p.x, p.y, 18 + ((Math.random() * 12) | 0), 1)
        }
      } else {
        // hotovo → po krátké pauze znovu od počátku, déšť běží nepřetržitě
        d.respawnIn -= dt
        if (d.respawnIn <= 0) this.revive(d)
      }
      d.flipIn -= dt
      if (d.flipIn <= 0) {
        d.flipIn = (0.5 + Math.random()) / cs
        const n = d.glyphs.length
        const flips = 1 + ((Math.random() * Math.max(1, n * 0.45)) | 0)
        for (let f = 0; f < flips; f++) d.glyphs[(Math.random() * n) | 0] = (Math.random() * this.chars.length) | 0
      }
      if (d.hot > 0) d.hot -= dt
    }

    this.updateParticles(dt)
  }

  // ── částice (jiskry + ohňostroj) ───────────────────────────────────────────
  private burst(x: number, y: number, n: number, power: number, color?: string) {
    const room = MAX_PARTS - this.parts.length
    if (room <= 0) return
    const total = Math.min(n, room)
    for (let i = 0; i < total; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = (30 + Math.random() * 130) * power
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30 * power,
        life: 0,
        max: 0.55 + Math.random() * 0.55,
        size: 1.5 + Math.random() * 2.4,
        color: color || `hsl(${(Math.random() * 360) | 0},100%,${55 + Math.random() * 25}%)`,
      })
    }
  }

  private updateParticles(dt: number) {
    const ps = this.parts
    let w = 0
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]
      p.life += dt
      if (p.life >= p.max) continue
      p.vy += 190 * dt
      p.vx *= 0.985
      p.vy *= 0.985
      p.x += p.vx * dt
      p.y += p.vy * dt
      ps[w++] = p
    }
    ps.length = w
  }

  private renderParticles(ctx: CanvasRenderingContext2D) {
    const ps = this.parts
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]
      const a = 1 - p.life / p.max
      if (a <= 0) continue
      ctx.globalAlpha = a
      ctx.fillStyle = p.color
      const s = p.size
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s)
    }
  }

  // ── kreslení ───────────────────────────────────────────────────────────────
  private blit(atlas: Atlas | null, index: number, x: number, y: number) {
    if (!atlas || index >= atlas.count) return
    this.ctx.drawImage(atlas.canvas, index * atlas.cw, 0, atlas.cw, atlas.ch, x, y, this.cellW, this.cellH)
  }

  private render() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.w, this.h)

    const dir = this.cfg.direction
    const vertical = dir === 'down' || dir === 'up'
    const forward = dir === 'down' || dir === 'right'
    const halfW = this.cellW / 2
    const halfH = this.cellH / 2
    const axisStep = this.axisStep
    const trackStep = this.trackStep
    const pointerActive = this.pointerIn && this.cfg.cursorEffect !== 'none'
    const px = this.pointerX
    const py = this.pointerY
    const hitR2 = this.hitR2
    const sparks = this.cfg.cursorEffect === 'sparks'

    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i]
      if (d.delay > 0 || d.state === 2) continue
      const count = d.gap <= 0 ? 0 : Math.min(d.len, Math.ceil(d.gap / axisStep))
      if (count <= 0) continue
      const blink = Math.sin(this.time * 8 + d.blink) * 0.5 + 0.5

      for (let k = 0; k < count; k++) {
        let cx: number
        let cy: number
        if (vertical) {
          cx = d.track * trackStep + halfW
          cy = forward ? d.pos - k * axisStep : d.pos + k * axisStep
        } else {
          cy = d.track * trackStep + halfH
          cx = forward ? d.pos - k * axisStep : d.pos + k * axisStep
        }
        if (cx + halfW < 0 || cx - halfW > this.w || cy + halfH < 0 || cy - halfH > this.h) continue

        const idx = d.glyphs[k]
        const x = cx - halfW
        const y = cy - halfH

        let hit = false
        if (pointerActive) {
          const dx = cx - px
          const dy = cy - py
          hit = dx * dx + dy * dy < hitR2
        }

        if (hit) {
          ctx.globalAlpha = 1
          this.blit(this.cursorAtlas, idx, x, y)
          if (sparks && k === 0 && d.hot <= 0) {
            d.hot = 0.18
            this.burst(cx, cy, 6, 0.55, this.cfg.cursor)
          }
        } else if (k === 0) {
          ctx.globalAlpha = 1
          this.blit(this.headAtlas, idx, x, y)
          if (blink > 0.04) {
            ctx.globalAlpha = blink
            this.blit(this.whiteAtlas, idx, x, y)
          }
        } else {
          ctx.globalAlpha = 0.07 + (1 - k / count) * 0.9
          this.blit(this.columnAtlas, idx, x, y)
        }
      }
    }

    this.renderParticles(ctx)
    ctx.globalAlpha = 1
  }

  // ── ukazatel myši ──────────────────────────────────────────────────────────
  private onPointerMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect()
    this.pointerX = e.clientX - r.left
    this.pointerY = e.clientY - r.top
    this.pointerIn = true
    if (!this.running) this.dirty = true
  }

  private onPointerLeave = () => {
    this.pointerIn = false
    if (!this.running) this.dirty = true
  }
}
