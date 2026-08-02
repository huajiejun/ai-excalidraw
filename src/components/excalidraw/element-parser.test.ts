import { describe, expect, it } from 'vitest'
import { parseExcalidrawElements } from './element-parser'

describe('parseExcalidrawElements', () => {
  it('parses nested objects and escapes', () => {
    const text = `
前言
{"id":"box","type":"rectangle","x":10,"y":20,"width":100,"height":80,"boundElements":[{"type":"text","id":"t1"}]}
{"id":"t1","type":"text","x":20,"y":30,"width":60,"height":25,"text":"说\\"你好\\"{ok}","containerId":"box"}
`
    const { elements } = parseExcalidrawElements(text)
    expect(elements).toHaveLength(2)
    expect(elements[0].id).toBe('box')
    expect(elements[1].text).toBe('说"你好"{ok}')
  })

  it('supports incremental streaming with processedLength', () => {
    const part1 = '{"id":"a","type":"rectangle","x":1,"y":1,"width":10,"height":10}'
    const first = parseExcalidrawElements(part1, 0)
    expect(first.elements).toHaveLength(1)

    const part2 =
      part1 + '\n{"id":"b","type":"ellipse","x":2,"y":2,"width":10,"height":10}'
    // remainingBuffer after first is empty, so processedLength = part1 length
    const processed = part1.length
    const next = parseExcalidrawElements(part2, processed)
    expect(first.remainingBuffer).toBe('')
    expect(next.elements.map((e) => e.id)).toEqual(['b'])
  })

  it('waits for incomplete JSON', () => {
    const text = 'hello {"id":"x","type":"rectangle","x":1'
    const result = parseExcalidrawElements(text)
    expect(result.elements).toHaveLength(0)
    expect(result.remainingBuffer).toContain('{"id":"x"')
  })

  it('skips objects without id', () => {
    const text = '{"type":"rectangle","x":1,"y":1}'
    const result = parseExcalidrawElements(text)
    expect(result.elements).toHaveLength(0)
  })
})
