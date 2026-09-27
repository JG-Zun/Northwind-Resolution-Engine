// Deliberately simple, fully visible backlog model (shown on screen):
//   backlog[t+1] = max(0, backlog[t] + inflow*(1 - inflowCut) - capacity*(1 + capacityUplift))
//   days_to_close[t] ≈ backlog[t] / (closures per day)   (Little's law)
export function forecast({ backlog0, inflow, capacity, inflowCut, capacityUplift, months = 12 }) {
  const out = []
  let b = backlog0
  const closures = capacity * (1 + capacityUplift)
  for (let t = 0; t <= months; t++) {
    out.push({ month: t, backlog: Math.round(b), days: closures > 0 ? +((b / closures) * 30).toFixed(1) : null })
    b = Math.max(0, b + inflow * (1 - inflowCut) - closures)
  }
  return out
}
