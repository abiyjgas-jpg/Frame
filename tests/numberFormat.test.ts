import { describe, expect, it } from 'vitest'
import { inferNumberFormat } from '../src/presentation/numberFormat'

describe('inferNumberFormat', () => {
  it('percentages keep their decimals', () => {
    expect(inferNumberFormat([[0.12]], [['12%']])(0.08)).toBe('8%')
    expect(inferNumberFormat([[0.125]], [['12.5%']])(0.0834)).toBe('8.3%')
  })
  it('currency prefix and separators', () => {
    const f = inferNumberFormat([[1200]], [['$1,200.00']])
    expect(f(65000.5)).toBe('$65,000.50')
    expect(f(-12)).toBe('-$12.00')
  })
  it('skips header text and finds the first number', () => {
    const f = inferNumberFormat([['', 'FY26'], ['Rev', 1000]], [['', 'FY26'], ['Rev', '1,000']])
    expect(f(115000)).toBe('115,000')
  })
  it('falls back to plain grouped numbers', () => {
    expect(inferNumberFormat([], [])(1234.567)).toBe('1,234.57')
  })
})
