import { LayoutDashboard, Search, Bot, TrendingDown, Banknote, Zap } from 'lucide-react'

const NAV = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'diagnosis', label: 'Diagnosis Explorer', Icon: Search },
  { id: 'pilot', label: 'AI Pilot Review', Icon: Bot },
  { id: 'forecast', label: 'Backlog Forecast', Icon: TrendingDown },
  { id: 'value', label: 'Value Case', Icon: Banknote },
]

export default function Sidebar({ view, onNavigate }) {
  return (
    <aside className="w-60 shrink-0 bg-slate-900 text-slate-300 flex flex-col print:hidden">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white"><Zap size={18} /></div>
        <div className="leading-tight">
          <div className="text-white font-semibold text-sm">Northwind</div>
          <div className="text-[11px] text-slate-400">Evidence Dashboard</div>
        </div>
      </div>
      <nav className="p-3 space-y-1 flex-1">
        {NAV.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => onNavigate(id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${view === id ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
            <Icon size={18} /> {label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500">All figures computed from the raw CSVs in /public/data.</div>
    </aside>
  )
}
