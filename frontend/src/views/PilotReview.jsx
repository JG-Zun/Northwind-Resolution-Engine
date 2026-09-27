import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from 'recharts'
import { pct, num } from '../lib/stats'

const SERIES = [
  ['fully_contained_rate', '#16a34a'],
  ['escalated_to_agent_rate', '#d97706'],
  ['abandoned_rate', '#dc2626'],
  ['repeat_contact_within_7_days_rate', '#7c3aed'],
  ['complaint_raised_after_session_rate', '#0f172a'],
]

export default function PilotReview({ data }) {
  const { pilot } = data
  const cols = Object.keys(pilot[0] || {})
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">AI Pilot Review (AskNorthwind, 2025)</h1>
        <p className="text-sm text-slate-500">Raw monthly pilot results. What does “containment” hide? Compare it with repeat contact and complaints raised afterwards.</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={pilot}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {SERIES.map(([k, c]) => <Line key={k} dataKey={k} stroke={c} strokeWidth={2} dot />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>{cols.map((c) => <th key={c} className="px-3 py-2">{c.replaceAll('_', ' ')}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pilot.map((r, i) => (
              <tr key={i}>{cols.map((c) => <td key={c} className="px-3 py-2">{c.endsWith('_rate') ? pct(r[c]) : typeof r[c] === 'number' ? num(r[c], 2) : r[c]}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
