// data/lib/pricing.mjs
// Společné cenové počty pro agenty LOYO OS — Lopatinka i Stěpán.
// Bez závislostí: jen čisté funkce nad polem nabídkových cen.

export function median(values) {
  const list = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b)
  if (!list.length) return 0
  const mid = Math.floor(list.length / 2)
  return list.length % 2 ? list[mid] : Math.round((list[mid - 1] + list[mid]) / 2)
}

export function quantile(sorted, p) {
  if (!sorted.length) return 0
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))]
}

// Odhad tržní ceny z nabídkových cen: ořízne extrémy (1 Kč aukce, nadhozené kusy),
// vrátí medián + percentily a doporučenou cenu (medián × koeficient stavu).
export function priceStats(prices, config = {}) {
  const all = prices.filter((p) => Number.isFinite(p) && p > 0)
  if (!all.length) return null

  let sorted = [...all].sort((a, b) => a - b)
  if (sorted.length >= 5) {
    const m = median(sorted)
    const trimmed = sorted.filter((p) => p >= m / 3 && p <= m * 3)
    if (trimmed.length >= 3) sorted = trimmed
  }

  const base = median(sorted)
  const factor = Number(config.__factor ?? 1)
  const rounding = Math.max(1, Number(config.roundingCzk ?? 50))
  const round = (v) => Math.max(rounding, Math.round(v / rounding) * rounding)
  const recommended = round(base * factor)

  return {
    count: sorted.length,
    min: sorted[0],
    p25: quantile(sorted, 0.25),
    median: base,
    p75: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1],
    recommended,
    quick: round(recommended * Number(config.quickSaleFactor ?? 0.9)),
    patient: round(recommended * Number(config.patientSaleFactor ?? 1.1)),
    lowConfidence: sorted.length < Number(config.minComparableCount ?? 3),
  }
}
