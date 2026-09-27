// Small pure helpers used by every view. No data-specific logic lives here.

export const truthy = (v) =>
  v === true || (typeof v === 'string' && ['true', '1', 'yes', 'y'].includes(v.trim().toLowerCase())) || v === 1

export const monthOf = (d) => (d == null ? '' : String(d).slice(0, 7))

export const sum = (xs) => xs.reduce((s, x) => s + (Number(x) || 0), 0)

export function mean(xs) {
  const v = xs.filter((x) => x !== null && x !== '' && x !== undefined).map(Number).filter((x) => Number.isFinite(x))
  return v.length ? sum(v) / v.length : null
}

// Share of rows where predicate holds (0..1).
export const rate = (rows, pred) => (rows.length ? rows.filter(pred).length / rows.length : null)

export function groupBy(rows, keyFn) {
  const m = new Map()
  for (const r of rows) {
    const k = keyFn(r)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(r)
  }
  return m
}

// Left join: each left row gets the matching right row's fields (right wins on clash only if absent on left).
export function leftJoin(left, right, leftKey, rightKey) {
  const idx = new Map(right.map((r) => [rightKey(r), r]))
  return left.map((l) => ({ ...(idx.get(leftKey(l)) || {}), ...l }))
}

export function pearson(pairs) {
  const p = pairs.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
  const n = p.length
  if (n < 3) return { r: null, n }
  const mx = sum(p.map((a) => a[0])) / n
  const my = sum(p.map((a) => a[1])) / n
  let sxy = 0, sxx = 0, syy = 0
  for (const [x, y] of p) {
    sxy += (x - mx) * (y - my)
    sxx += (x - mx) ** 2
    syy += (y - my) ** 2
  }
  return { r: sxx && syy ? sxy / Math.sqrt(sxx * syy) : null, n }
}

// Fractions may be stored as 0..1 or 0..100; show both as a percentage.
export const pct = (v, d = 1) => (v == null || !Number.isFinite(v) ? '—' : `${(v <= 1 ? v * 100 : v).toFixed(d)}%`)
export const num = (v, d = 1) => (v == null || !Number.isFinite(v) ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: d }))
