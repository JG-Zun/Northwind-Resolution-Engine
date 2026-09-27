import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from 'recharts'
import { forecast } from '../lib/forecast'
import { mean, num } from '../lib/stats'

function Field({ label, value, onChange, step = 1, hint }) {
  return (
    <label className="text-xs text-slate-500 flex flex-col gap-1">
      {label}
      <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-800 w-40" />
      {hint && <span className="text-[11px] text-slate-400 max-w-40">{hint}</span>}
    </label>
  )
}

function Slider({ label, value, onChange, max }) {
  return (
    <label className="text-xs text-slate-500 flex flex-col gap-1 w-64">
      <span className="flex justify-between"><span>{label}</span><b className="text-slate-800">{Math.round(value * 100)}%</b></span>
      <input type="range" min="0" max={max} step="0.01" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

export default function Forecast({ data }) {
  const { kpis, complaints } = data
  const seed = useMemo(() => {
    const tail = kpis.slice(-6)
    return {
      backlog: complaints.filter((c) => !c.date_closed).length,
      inflow: Math.round(mean(tail.map((k) => k.complaints_opened)) ?? 0),
      capacity: Math.round(mean(tail.map((k) => k.complaints_closed)) ?? 0),
    }
  }, [kpis, complaints])

  const [backlog0, setBacklog] = useState(seed.backlog)
  const [inflow, setInflow] = useState(seed.inflow)
  const [capacity, setCapacity] = useState(seed.capacity)
  const [inflowCut, setCut] = useState(0)
  const [capacityUplift, setUp] = useState(0)

  const base = forecast({ backlog0, inflow, capacity, inflowCut: 0, capacityUplift: 0 })
  const scen = forecast({ backlog0, inflow, capacity, inflowCut, capacityUplift })
  const chart = base.map((b, i) => ({ month: b.month, 'Backlog: no change': b.backlog, 'Backlog: scenario': scen[i].backlog, 'Days: no change': b.days, 'Days: scenario': scen[i].days }))
  const end = scen[scen.length - 1]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Backlog Forecast</h1>
        <p className="text-sm text-slate-500">
          Starting values come from the data (open complaints; last-6-month mean opened/closed from the KPI file). Interventions start at 0%, so set them from your own diagnosis.
        </p>
      </div>
      <div className="flex flex-wrap gap-6 items-start bg-white rounded-xl border border-slate-200 p-4">
        <Field label="Opening backlog" value={backlog0} onChange={setBacklog} hint="open complaints in data" />
        <Field label="New complaints / month" value={inflow} onChange={setInflow} hint="KPI file, last 6 mo mean" />
        <Field label="Closures / month" value={capacity} onChange={setCapacity} hint="KPI file, last 6 mo mean" />
        <div className="space-y-3">
          <Slider label="Complaints prevented at source" value={inflowCut} onChange={setCut} max={0.8} />
          <Slider label="Closure capacity uplift" value={capacityUplift} onChange={setUp} max={1} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[['Backlog (open complaints)', ['Backlog: no change', 'Backlog: scenario']], ['Implied days to close (backlog ÷ daily closures)', ['Days: no change', 'Days: scenario']]].map(([t, keys]) => (
          <div key={t} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm font-medium text-slate-700 mb-2">{t}</div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} label={{ value: 'months from now', position: 'insideBottom', offset: -4, fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip /><Legend />
                <Line dataKey={keys[0]} stroke="#94a3b8" strokeDasharray="5 4" dot={false} strokeWidth={2} />
                <Line dataKey={keys[1]} stroke="#2563eb" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
      <div className="bg-slate-100 rounded-xl p-4 text-sm text-slate-700 space-y-1">
        <div>Month 12 scenario: backlog <b>{num(end.backlog, 0)}</b>, implied days to close <b>{num(end.days)}</b>.</div>
        <div className="font-mono text-xs text-slate-500">backlog[t+1] = max(0, backlog[t] + inflow·(1 − prevented) − closures·(1 + uplift)); days ≈ backlog ÷ closures × 30</div>
        <div className="text-xs text-slate-500">Not modelled: how days-to-close translates into the regulator score. The team must justify that link with evidence before claiming a 4.0 score.</div>
      </div>
    </div>
  )
}
