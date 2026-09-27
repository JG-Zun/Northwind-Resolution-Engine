import { useState } from 'react'
import { useData } from './lib/data'
import Sidebar from './components/Sidebar'
import Overview from './views/Overview'
import Diagnosis from './views/Diagnosis'
import PilotReview from './views/PilotReview'
import Forecast from './views/Forecast'
import ValueCase from './views/ValueCase'

const VIEWS = { overview: Overview, diagnosis: Diagnosis, pilot: PilotReview, forecast: Forecast, value: ValueCase }

export default function App() {
  const [view, setView] = useState('overview')
  const { data, error } = useData()
  const View = VIEWS[view]
  return (
    <div className="flex h-screen">
      <Sidebar view={view} onNavigate={setView} />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8 print:overflow-visible">
        {error && <div className="text-red-600">Failed to load data: {String(error.message || error)}</div>}
        {!data && !error && <div className="text-slate-500">Loading data…</div>}
        {data && <View data={data} />}
      </main>
    </div>
  )
}
