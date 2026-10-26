import { describe, expect, it } from 'bun:test'
import { Value } from '@sinclair/typebox/value'
import { DataResponseContainerSchema, DataParamsSchema } from '../src/schemas/data'

describe('schemas', () => {
  it('DataResponseContainer round-trips a sample payload', () => {
    const sample = {
      apiVersion: '2.1.0',
      request: { command: '/v2/coal/aggregate-production/data/' },
      response: {
        data: [{ period: '2020', value: 100 }, { period: '2021', value: 110 }],
        dateFormat: 'YYYY',
        description: 'Aggregate production',
        frequency: 'annual',
        total: 2,
      },
    }
    expect(Value.Check(DataResponseContainerSchema, sample)).toBe(true)
  })

  it('DataParams accepts a typical query', () => {
    const valid = {
      data: ['production', 'price'],
      facets: { stateId: ['CA', 'TX'] },
      frequency: 'annual',
      start: '2020',
      end: '2024',
      length: 50,
      sort: [{ column: 'period', direction: 'asc' as const }],
    }
    expect(Value.Check(DataParamsSchema, valid)).toBe(true)
  })

  it('DataParams rejects bad sort direction', () => {
    const bad = {
      data: ['x'],
      sort: [{ column: 'period', direction: 'sideways' }],
    }
    expect(Value.Check(DataParamsSchema, bad)).toBe(false)
  })
})
