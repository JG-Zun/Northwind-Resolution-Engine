import Papa from 'papaparse'
import { useEffect, useState } from 'react'

const FILES = {
  complaints: 'northwind_complaints.csv',
  systems: 'northwind_systems.csv',
  kpis: 'northwind_monthly_kpis.csv',
  meter: 'northwind_meter_reads.csv',
  pilot: 'northwind_ai_pilot_2025.csv',
  costs: 'northwind_unit_costs.csv',
}

const parse = (name) =>
  new Promise((resolve, reject) =>
    Papa.parse(`${import.meta.env.BASE_URL}data/${name}`, {
      download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: (r) => resolve(r.data),
      error: reject,
    }),
  )

let cache
export function loadAll() {
  cache ??= Promise.all(Object.entries(FILES).map(async ([k, f]) => [k, await parse(f)])).then(Object.fromEntries)
  return cache
}

export function useData() {
  const [state, setState] = useState({ data: null, error: null })
  useEffect(() => {
    loadAll().then((data) => setState({ data, error: null })).catch((error) => setState({ data: null, error }))
  }, [])
  return state
}
