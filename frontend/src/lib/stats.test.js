import { describe, it, expect } from 'vitest'
import { truthy, mean, rate, groupBy, leftJoin, pearson, monthOf } from './stats'

const rows = [
  { g: 'a', d: 10, b: 'True' },
  { g: 'a', d: 20, b: 'False' },
  { g: 'b', d: 30, b: 'true' },
  { g: 'b', d: 40, b: '1' },
  { g: 'b', d: 50, b: '' },
]

describe('stats', () => {
  it('truthy handles common encodings', () => {
    expect([true, 'True', 'yes', '1', 1].every(truthy)).toBe(true)
    expect(['False', '', '0', null, undefined].some(truthy)).toBe(false)
  })
  it('mean ignores non-numbers', () => {
    expect(mean([10, 20, 'x', null])).toBe(15)
    expect(mean([])).toBeNull()
  })
  it('rate and groupBy', () => {
    expect(rate(rows, (r) => truthy(r.b))).toBe(3 / 5)
    const g = groupBy(rows, (r) => r.g)
    expect(g.get('a')).toHaveLength(2)
    expect(mean(g.get('b').map((r) => r.d))).toBe(40)
  })
  it('leftJoin keeps left rows and adds right fields', () => {
    const out = leftJoin([{ id: 1 }, { id: 2 }], [{ k: 1, name: 'x' }], (l) => l.id, (r) => r.k)
    expect(out).toEqual([{ k: 1, name: 'x', id: 1 }, { id: 2 }])
  })
  it('pearson perfect and n', () => {
    expect(pearson([[1, 2], [2, 4], [3, 6]]).r).toBeCloseTo(1)
    expect(pearson([[1, 2]]).r).toBeNull()
  })
  it('monthOf', () => expect(monthOf('2025-03-14')).toBe('2025-03'))
})
