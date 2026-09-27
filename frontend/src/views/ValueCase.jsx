import { useState } from 'react'
import { Plus, Trash2, Printer } from 'lucide-react'
import { valueModel } from '../lib/value'
import { num } from '../lib/stats'

const KINDS = { once: 'One-off build cost', annual_cost: 'Annual run cost', annual_benefit: 'Annual saving / benefit' }
const money = (v) => (v == null ? '—' : `£${num(v, 0)}`)

export default function ValueCase({ data }) {
  const [lines, setLines] = useState([])
  const [downside, setDownside] = useState(0.5)
  const [years, setYears] = useState(3)

  const add = (l = {}) => setLines((ls) => [...ls, { kind: 'annual_benefit', label: '', qty: 0, unit: 0, source: '', ...l }])
  const set = (i, patch) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const undeclared = lines.filter((l) => !l.label.trim() || !l.source.trim()).length

  const base = valueModel(lines, 1, years)
  const low = valueModel(lines, downside, years)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Value Case</h1>
          <p className="text-sm text-slate-500">Every line needs a label and a source/rationale. Nothing is pre-filled except the reference costs from the unit-costs file.</p>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-2 text-sm bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700">
          <Printer size={16} /> Print one-page summary
        </button>
      </div>
      <h1 className="hidden print:block text-xl font-semibold">Northwind: One-Page Value Case</h1>

      <section className="bg-white rounded-xl border border-slate-200 print:hidden">
        <div className="px-4 py-2 text-xs uppercase text-slate-500 bg-slate-50 rounded-t-xl">Reference unit costs (northwind_unit_costs.csv). Click + to use as a line.</div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {data.costs.map((c) => (
              <tr key={c.item}>
                <td className="px-4 py-2 font-medium">{c.item}</td>
                <td className="px-4 py-2">£{num(c.unit_cost, 2)} / {c.unit}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{c.source_note}</td>
                <td className="px-2"><button title="Use as line" onClick={() => add({ label: c.item, unit: c.unit_cost, source: `unit_costs.csv: ${c.source_note}` })} className="text-blue-600"><Plus size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between print:hidden">
          <h2 className="font-semibold text-slate-900">Assumption lines (quantity × unit value, per year for annual lines)</h2>
          <button onClick={() => add()} className="flex items-center gap-1 text-sm text-blue-600"><Plus size={16} /> Add line</button>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr><th className="px-3 py-2">Type</th><th className="px-3 py-2">What</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">£ each</th><th className="px-3 py-2">£ total</th><th className="px-3 py-2">Source / rationale</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">No lines yet. Add costs and benefits with sources.</td></tr>}
              {lines.map((l, i) => (
                <tr key={i} className={!l.label.trim() || !l.source.trim() ? 'bg-amber-50' : ''}>
                  <td className="px-3 py-1"><select value={l.kind} onChange={(e) => set(i, { kind: e.target.value })} className="border border-slate-300 rounded px-1 py-1 text-xs">{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                  <td className="px-3 py-1"><input value={l.label} onChange={(e) => set(i, { label: e.target.value })} className="border border-slate-300 rounded px-2 py-1 w-44" /></td>
                  <td className="px-3 py-1"><input type="number" value={l.qty} onChange={(e) => set(i, { qty: e.target.value })} className="border border-slate-300 rounded px-2 py-1 w-24" /></td>
                  <td className="px-3 py-1"><input type="number" value={l.unit} onChange={(e) => set(i, { unit: e.target.value })} className="border border-slate-300 rounded px-2 py-1 w-24" /></td>
                  <td className="px-3 py-1">{money((Number(l.qty) || 0) * (Number(l.unit) || 0))}</td>
                  <td className="px-3 py-1"><input value={l.source} onChange={(e) => set(i, { source: e.target.value })} placeholder="required" className="border border-slate-300 rounded px-2 py-1 w-64" /></td>
                  <td className="px-2 print:hidden"><button onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600"><Trash2 size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {undeclared > 0 && <p className="text-xs text-amber-700">{undeclared} line(s) missing a label or source: undeclared estimates lose points.</p>}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap gap-6 items-end print:hidden">
          <label className="text-xs text-slate-500 flex flex-col gap-1 w-64">
            <span className="flex justify-between"><span>Downside: benefits achieved</span><b className="text-slate-800">{Math.round(downside * 100)}%</b></span>
            <input type="range" min="0" max="1" step="0.05" value={downside} onChange={(e) => setDownside(Number(e.target.value))} />
          </label>
          <label className="text-xs text-slate-500 flex flex-col gap-1">Horizon (years)
            <input type="number" min="1" max="10" value={years} onChange={(e) => setYears(Number(e.target.value) || 1)} className="border border-slate-300 rounded px-2 py-1.5 text-sm w-24" />
          </label>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2" /><th className="px-3 py-2">Base case</th><th className="px-3 py-2">Downside ({Math.round(downside * 100)}% of benefits)</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {[['Build cost (one-off)', 'build'], ['Run cost / year', 'run'], ['Benefit / year', 'benefit'], ['Net / year', 'net']].map(([l, k]) => (
                <tr key={k}><td className="px-3 py-2">{l}</td><td className="px-3 py-2 font-medium">{money(base[k])}</td><td className="px-3 py-2 font-medium">{money(low[k])}</td></tr>
              ))}
              <tr><td className="px-3 py-2">Payback</td><td className="px-3 py-2 font-semibold">{base.paybackMonths == null ? 'never' : `${num(base.paybackMonths)} months`}</td><td className="px-3 py-2 font-semibold">{low.paybackMonths == null ? 'never' : `${num(low.paybackMonths)} months`}</td></tr>
              <tr><td className="px-3 py-2">Cumulative net over {years} yr</td><td className="px-3 py-2 font-semibold">{money(base.cumulative)}</td><td className="px-3 py-2 font-semibold">{money(low.cumulative)}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">Simple undiscounted model; benefits assumed to start immediately. State the ramp-up assumption and any outside sources (cited) in the line sources above.</p>
      </section>
    </div>
  )
}
