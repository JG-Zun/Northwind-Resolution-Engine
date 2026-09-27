import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import KpiTile from '../components/KpiTile'
import { mean, rate, truthy, groupBy, pct, num } from '../lib/stats'

// Figures quoted in the challenge brief, for reconciliation against the raw data.
const BRIEF = { open: 1599, days: 38.2, breach: 0.77, satFrom: 4.3, satTo: 2.6, systems: 15 }

function Chart({ title, data, dataKey, color = '#2563eb', domain }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-sm font-medium text-slate-700 mb-2">{title}</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} domain={domain} />
          <Tooltip />
          <Line type="monotone" dataKey={dataKey} stroke={color} dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function Overview({ data }) {
  const { complaints, kpis, systems } = data
  const s = useMemo(() => {
    const isOpen = (c) => !c.date_closed
    const closed = complaints.filter((c) => !isOpen(c))
    return {
      total: complaints.length,
      open: complaints.filter(isOpen).length,
      days: mean(closed.map((c) => c.days_to_close)),
      breach: rate(complaints, (c) => truthy(c.sla_breach)),
      statuses: [...groupBy(complaints, (c) => c.status ?? '(blank)')].map(([k, v]) => [k, v.length]),
    }
  }, [complaints])

  const first = kpis[0], last = kpis[kpis.length - 1]
  const rows = [
    ['Open complaints (date_closed blank)', BRIEF.open, num(s.open, 0)],
    ['Mean days to close (closed complaints)', BRIEF.days, num(s.days)],
    ['SLA breach rate', pct(BRIEF.breach), pct(s.breach)],
    ['Regulator score, first → last month', `${BRIEF.satFrom} → ${BRIEF.satTo}`, `${num(first?.regulator_satisfaction_score_of_5, 2)} → ${num(last?.regulator_satisfaction_score_of_5, 2)}`],
    ['Systems in estate', BRIEF.systems, systems.length],
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500">Headline figures recomputed from raw data and reconciled against the brief.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile label="Complaint rows" value={num(s.total, 0)} />
        <KpiTile label="Open" value={num(s.open, 0)} tone="text-blue-700" />
        <KpiTile label="Mean days to close" value={num(s.days)} />
        <KpiTile label="SLA breach rate" value={pct(s.breach)} tone="text-red-600" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-2">Reconciliation</th><th className="px-4 py-2">Brief says</th><th className="px-4 py-2">Data says</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(([l, b, d]) => (
              <tr key={l}><td className="px-4 py-2">{l}</td><td className="px-4 py-2 text-slate-500">{b}</td><td className="px-4 py-2 font-medium">{d}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-100">
          Status values present: {s.statuses.map(([k, n]) => `${k} (${n})`).join(', ')}. If “open” is defined differently in your analysis, say so in the pitch.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Chart title="Complaints opened vs closed" data={kpis} dataKey="complaints_opened" />
        <Chart title="Average days to close" data={kpis} dataKey="avg_days_to_close" color="#dc2626" />
        <Chart title="First-contact resolution" data={kpis} dataKey="first_contact_resolution_rate" color="#0891b2" />
        <Chart title="Regulator satisfaction (of 5)" data={kpis} dataKey="regulator_satisfaction_score_of_5" color="#7c3aed" />
        <Chart title="Cost to serve per account" data={kpis} dataKey="cost_to_serve_per_account" color="#d97706" />
        <Chart title="Inbound calls" data={kpis} dataKey="inbound_calls" color="#475569" />
      </div>
    </div>
  )
}
