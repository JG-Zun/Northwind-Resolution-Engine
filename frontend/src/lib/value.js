// lines: { kind: 'once' | 'annual_cost' | 'annual_benefit', qty, unit, ... }
export function valueModel(lines, benefitFactor = 1, horizonYears = 3) {
  const amt = (l) => (Number(l.qty) || 0) * (Number(l.unit) || 0)
  const total = (k) => lines.filter((l) => l.kind === k).reduce((s, l) => s + amt(l), 0)
  const build = total('once')
  const run = total('annual_cost')
  const benefit = total('annual_benefit') * benefitFactor
  const net = benefit - run
  return {
    build, run, benefit, net,
    paybackMonths: net > 0 ? (build / net) * 12 : null,
    cumulative: benefit * horizonYears - run * horizonYears - build,
    horizonYears,
  }
}
