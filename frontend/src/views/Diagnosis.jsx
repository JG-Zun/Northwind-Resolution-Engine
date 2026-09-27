import { useMemo, useState } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { groupBy, mean, rate, sum, truthy, monthOf, pearson, leftJoin, pct, num } from '../lib/stats'

const DIMS = ['category', 'region', 'source_system', 'channel', 'priority', 'resolution_action', 'transferred_between_systems', 'resolvable_by_information_only', 'reopened', 'sla_breach']

// Each metric: [label, fn(rows) -> number]
const METRICS = {
  Volume: [(r) => r.length, (v) => num(v, 0)],
  'Mean days to close': [(r) => mean(r.map((x) => x.days_to_close)), num],
  'Breach %': [(r) => rate(r, (x) => truthy(x.sla_breach)), pct],
  'Reopen %': [(r) => rate(r, (x) => truthy(x.reopened)), pct],
  'Transferred %': [(r) => rate(r, (x) => truthy(x.transferred_between_systems)), pct],
  'Info-only %': [(r) => rate(r, (x) => truthy(x.resolvable_by_information_only)), pct],
  'Bill correction £ (total)': [(r) => sum(r.map((x) => x.bill_correction_value)), (v) => num(v, 0)],
  'Bill correction £ (mean)': [(r) => mean(r.map((x) => x.bill_correction_value)), (v) => num(v, 2)],
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="text-xs text-slate-500 flex flex-col gap-1">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-800 bg-white">
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  )
}

function Pivot({ complaints, systems }) {
  const [dim, setDim] = useState('category')
  const [dim2, setDim2] = useState('(none)')
  const [sort, setSort] = useState('Volume')
  // join to the systems file when grouping by source_system so age / integration are visible
  const rows = useMemo(() => {
    const byKey = (s) => s.system_id
    const byName = (s) => s.system_name
    const hitId = complaints.some((c) => systems.some((s) => byKey(s) === c.source_system))
    return leftJoin(complaints, systems, (c) => c.source_system, hitId ? byKey : byName)
  }, [complaints, systems])

  const table = useMemo(() => {
    const keyFn = (r) => (dim2 === '(none)' ? String(r[dim]) : `${r[dim]} × ${r[dim2]}`)
    const [f] = METRICS[sort]
    return [...groupBy(rows, keyFn)]
      .map(([k, rs]) => ({ k, n: rs.length, vals: Object.fromEntries(Object.entries(METRICS).map(([m, [fn]]) => [m, fn(rs)])) }))
      .sort((a, b) => (b.vals[sort] ?? -Infinity) - (a.vals[sort] ?? -Infinity))
  }, [rows, dim, dim2, sort])

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-slate-900">1. Slice the complaints</h2>
      <div className="flex flex-wrap gap-4">
        <Select label="Group by" value={dim} onChange={setDim} options={DIMS} />
        <Select label="…and by" value={dim2} onChange={setDim2} options={['(none)', ...DIMS]} />
        <Select label="Sort by" value={sort} onChange={setSort} options={Object.keys(METRICS)} />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto max-h-[28rem]">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 sticky top-0">
            <tr><th className="px-3 py-2">{dim}{dim2 !== '(none)' ? ` × ${dim2}` : ''}</th>{Object.keys(METRICS).map((m) => <th key={m} className="px-3 py-2 whitespace-nowrap">{m}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.map((t) => (
              <tr key={t.k}>
                <td className="px-3 py-2 font-medium">{t.k}</td>
                {Object.entries(METRICS).map(([m, [, fmt]]) => <td key={m} className="px-3 py-2">{fmt(t.vals[m])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">{table.length} groups · {rows.length.toLocaleString()} complaints. Small groups are noisy, so check Volume before quoting a rate.</p>
    </section>
  )
}

function SystemsTable({ complaints, systems }) {
  const rows = useMemo(() => {
    const by = groupBy(complaints, (c) => c.source_system)
    return systems.map((s) => {
      const cs = by.get(s.system_id) ?? by.get(s.system_name) ?? []
      return { s, n: cs.length, days: mean(cs.map((c) => c.days_to_close)), transfer: rate(cs, (c) => truthy(c.transferred_between_systems)) }
    })
  }, [complaints, systems])
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-slate-900">2. Complaints × the application estate</h2>
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>{['System', 'Installed', 'Integration', 'Run cost / yr', 'Complaints', 'Mean days', 'Transferred %', 'Notes'].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ s, n, days, transfer }) => (
              <tr key={s.system_id}>
                <td className="px-3 py-2 font-medium">{s.system_name}</td>
                <td className="px-3 py-2">{s.year_installed}</td>
                <td className="px-3 py-2">{s.integration_method}</td>
                <td className="px-3 py-2">{num(s.annual_run_cost, 0)}</td>
                <td className="px-3 py-2">{num(n, 0)}</td>
                <td className="px-3 py-2">{num(days)}</td>
                <td className="px-3 py-2">{pct(transfer)}</td>
                <td className="px-3 py-2 text-xs text-slate-500 min-w-64">{s.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Complaints are matched to systems on source_system = system_id (or system_name). If a system shows 0, check the join key.</p>
    </section>
  )
}

function RegionMonth({ complaints, meter }) {
  const joined = useMemo(() => {
    const by = groupBy(complaints, (c) => `${c.region}|${monthOf(c.date_opened)}`)
    return meter.map((m) => {
      const cs = by.get(`${m.region}|${monthOf(m.month)}`) ?? []
      return {
        ...m,
        complaints: cs.length,
        complaints_per_1k_accounts: m.accounts ? (cs.length / m.accounts) * 1000 : null,
        mean_days: mean(cs.map((c) => c.days_to_close)),
        breach_rate: rate(cs, (c) => truthy(c.sla_breach)),
        bill_disputes: cs.filter((c) => String(c.category).toLowerCase().includes('bill')).length,
      }
    })
  }, [complaints, meter])

  const numericCols = ['estimated_read_rate', 'smart_meter_penetration', 'billing_exceptions_raised', 'systems_serving_region', 'accounts', 'complaints', 'complaints_per_1k_accounts', 'mean_days', 'breach_rate', 'bill_disputes']
  const [x, setX] = useState('estimated_read_rate')
  const [y, setY] = useState('complaints_per_1k_accounts')
  const pts = joined.map((r) => ({ x: r[x], y: r[y], label: `${r.region} ${r.month}` })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
  const { r, n } = pearson(pts.map((p) => [p.x, p.y]))

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-slate-900">3. Complaints × meter reads (region-month)</h2>
      <div className="flex flex-wrap gap-4">
        <Select label="X axis" value={x} onChange={setX} options={numericCols} />
        <Select label="Y axis" value={y} onChange={setY} options={numericCols} />
        <div className="text-sm self-end pb-1.5 text-slate-700">
          Pearson r = <b>{r == null ? '—' : r.toFixed(2)}</b> <span className="text-slate-400">(n = {n} region-months)</span>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" dataKey="x" name={x} tick={{ fontSize: 11 }} domain={['auto', 'auto']} label={{ value: x, position: 'insideBottom', offset: -4, fontSize: 11 }} />
            <YAxis type="number" dataKey="y" name={y} tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v) => num(v, 3)} />
            <Scatter data={pts} fill="#2563eb" fillOpacity={0.7} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-slate-400">Correlation is not causation. Region-month joins on region and YYYY-MM. If n is much smaller than the meter file's row count, the keys are not matching.</p>
    </section>
  )
}

export default function Diagnosis({ data }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Diagnosis Explorer</h1>
        <p className="text-sm text-slate-500">Neutral tooling: it sets no conclusion. Slice the data, connect files, and decide what the evidence supports.</p>
      </div>
      <Pivot complaints={data.complaints} systems={data.systems} />
      <SystemsTable complaints={data.complaints} systems={data.systems} />
      <RegionMonth complaints={data.complaints} meter={data.meter} />
    </div>
  )
}
