import { describe, expect, it } from 'vitest'
import {
  removeJsonObjects,
  parseThinkingContent,
  buildHistoryForModel,
  sanitizeAssistantForHistory,
} from './message-content'

describe('removeJsonObjects', () => {
  it('strips excalidraw element JSON', () => {
    const text = `说明一下
{"id":"r1","type":"rectangle","x":1,"y":2,"width":10,"height":10}
完成`
    expect(removeJsonObjects(text)).toBe('说明一下\n\n完成')
  })

  it('keeps braces inside strings', () => {
    const text = `{"id":"t1","type":"text","x":0,"y":0,"width":10,"height":10,"text":"a{b}c"}`
    expect(removeJsonObjects(text)).toBe('')
  })

  it('keeps incomplete JSON for later streaming', () => {
    const text = '前言 {"id":"r1","type":"rectangle"'
    expect(removeJsonObjects(text)).toContain('前言')
    expect(removeJsonObjects(text)).toContain('"id":"r1"')
  })

  it('preserves non-element JSON objects', () => {
    const text = '结果 {"ok":true,"count":1}'
    expect(removeJsonObjects(text)).toContain('{"ok":true,"count":1}')
  })
})

describe('parseThinkingContent', () => {
  it('extracts think blocks', () => {
    const { thinking, main } = parseThinkingContent(
      '<think>先画框</think>然后输出'
    )
    expect(thinking).toBe('先画框')
    expect(main).toBe('然后输出')
  })
})

describe('history helpers', () => {
  it('sanitizes assistant messages', () => {
    const content =
      '<think>思考</think>说明{"id":"a","type":"rectangle","x":1,"y":1,"width":1,"height":1}'
    expect(sanitizeAssistantForHistory(content)).toBe('说明')
  })

  it('builds bounded history and excludes trailing user', () => {
    const messages = [
      { role: 'user' as const, content: '画一个框' },
      { role: 'assistant' as const, content: '好的' },
      { role: 'user' as const, content: '改成红色' },
    ]
    const history = buildHistoryForModel(messages, true)
    expect(history).toEqual([
      { role: 'user', content: '画一个框' },
      { role: 'assistant', content: '好的' },
    ])
  })
})
