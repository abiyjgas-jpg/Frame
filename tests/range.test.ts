import { describe, expect, it } from 'vitest'
import { colToIndex, formatRange, indexToCol, intersects, parseRange } from '../src/bindings/range'

describe('range parsing', () => {
  it('parses single cells and ranges', () => {
    expect(parseRange('A1')).toEqual({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 })
    expect(parseRange('B10')).toEqual({ startRow: 9, startCol: 1, endRow: 9, endCol: 1 })
    expect(parseRange('a1:c3')).toEqual({ startRow: 0, startCol: 0, endRow: 2, endCol: 2 })
    expect(parseRange('$A$1:$B$2')).toEqual({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 })
  })
  it('normalises reversed ranges', () => {
    expect(parseRange('C3:A1')).toEqual(parseRange('A1:C3'))
  })
  it('handles multi-letter columns', () => {
    expect(colToIndex('Z')).toBe(25)
    expect(colToIndex('AA')).toBe(26)
    expect(colToIndex('AZ')).toBe(51)
    for (const i of [0, 25, 26, 701, 702, 16383]) expect(colToIndex(indexToCol(i))).toBe(i)
  })
  it('rejects garbage', () => {
    for (const bad of ['', 'A0', '1A', 'A1:B2:C3', 'Sheet1!A1', 'ABCD1', 'A1:']) expect(() => parseRange(bad)).toThrow()
  })
  it('round-trips formatting', () => {
    expect(formatRange(parseRange('B10'))).toBe('B10')
    expect(formatRange(parseRange('A1:C3'))).toBe('A1:C3')
  })
  it('detects intersection', () => {
    expect(intersects(parseRange('A1:A3'), parseRange('A2'))).toBe(true)
    expect(intersects(parseRange('A1:A3'), parseRange('B1:B3'))).toBe(false)
    expect(intersects(parseRange('A1:C3'), parseRange('C3:D4'))).toBe(true)
    expect(intersects(parseRange('A1:A3'), parseRange('A4'))).toBe(false)
  })
})
