export default function KpiTile({ label, value, sub, tone = 'text-slate-900' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${tone}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}
