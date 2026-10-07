import { describe, expect, it } from 'vitest'
import { clampSplit, fitScale } from '../src/utils/layout'

describe('clampSplit', () => {
  it('keeps ratios that leave both panes above minimum', () => {
    expect(clampSplit(0.5, 1440, 360, 420)).toBe(0.5)
  })
  it('clamps to the minimum widths', () => {
    expect(clampSplit(0.05, 1440, 360, 420)).toBeCloseTo(360 / 1440)
    expect(clampSplit(0.95, 1440, 360, 420)).toBeCloseTo(1 - 420 / 1440)
  })
  it('handles windows narrower than both minimums and bad input', () => {
    expect(clampSplit(0.9, 500, 360, 420)).toBeCloseTo(360 / 780)
    expect(clampSplit(NaN, 1440, 360, 420)).toBe(0.5)
  })
})

describe('fitScale', () => {
  it('fits by the tighter dimension', () => {
    expect(fitScale(1280, 720, 1280, 720)).toBe(1)
    expect(fitScale(640, 1000, 1280, 720)).toBe(0.5)
    expect(fitScale(2000, 360, 1280, 720)).toBe(0.5)
  })
  it('subtracts padding and never goes negative', () => {
    expect(fitScale(688, 1000, 1280, 720, 24)).toBe(0.5)
    expect(fitScale(10, 10, 1280, 720, 24)).toBe(0)
  })
})
