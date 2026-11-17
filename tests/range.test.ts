import { describe, expect, it } from 'vitest'
import { colToIndex, formatRange, indexToCol, intersects, parseRange, REF_ERROR, shiftRange } from '../src/bindings/range'

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

describe('shiftRange (rows/columns inserted or removed)', () => {
  const rows = (kind: 'insert' | 'remove', start: number, count: number) => ({ sheetId: 's', axis: 'row' as const, kind, start, count })
  const cols = (kind: 'insert' | 'remove', start: number, count: number) => ({ sheetId: 's', axis: 'col' as const, kind, start, count })

  it('moves a range down when rows are inserted above it, grows it when inserted inside', () => {
    expect(shiftRange('B3:D5', rows('insert', 0, 2))).toBe('B5:D7')
    expect(shiftRange('B3:D5', rows('insert', 2, 1))).toBe('B4:D6') // before row 3
    expect(shiftRange('B3:D5', rows('insert', 3, 1))).toBe('B3:D6') // inside
    expect(shiftRange('B3:D5', rows('insert', 5, 1))).toBe('B3:D5') // below
  })

  it('shrinks or moves a range when rows are removed, and gives #REF! when all of it goes', () => {
    expect(shiftRange('B3:D5', rows('remove', 0, 1))).toBe('B2:D4')
    expect(shiftRange('B3:D5', rows('remove', 3, 1))).toBe('B3:D4')
    expect(shiftRange('B3:D5', rows('remove', 1, 3))).toBe('B2:D2') // rows 2–4 gone, row 5 remains
    expect(shiftRange('B3:D5', rows('remove', 2, 3))).toBe(REF_ERROR)
    expect(shiftRange('C4', rows('remove', 3, 1))).toBe(REF_ERROR)
    expect(shiftRange('B3:D5', rows('remove', 9, 1))).toBe('B3:D5')
    expect(shiftRange(REF_ERROR, rows('insert', 0, 1))).toBe(REF_ERROR)
  })

  it('does the same for columns', () => {
    expect(shiftRange('B3:D5', cols('insert', 0, 1))).toBe('C3:E5')
    expect(shiftRange('B3:D5', cols('remove', 2, 1))).toBe('B3:C5')
    expect(shiftRange('B3', cols('remove', 1, 1))).toBe(REF_ERROR)
  })
})
