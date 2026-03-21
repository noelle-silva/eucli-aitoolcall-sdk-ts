import { detectToolRequestBlock, type DetectToolRequestBlockResult } from './detectToolRequestBlock.js'

export type TruncateAfterToolRequestBlockResult = {
  text: string
  detected: DetectToolRequestBlockResult
  toolRequestCompleted: boolean
}

export function truncateAfterToolRequestBlock(input: unknown): TruncateAfterToolRequestBlockResult {
  const text = typeof input === 'string' ? input : String(input ?? '')
  const detected = detectToolRequestBlock(text)
  if (detected.status === 'complete') {
    return { text: detected.keptText, detected, toolRequestCompleted: true }
  }
  return { text, detected, toolRequestCompleted: false }
}

export type ToolRequestStreamTruncator = {
  appendDelta: (delta: unknown) => {
    text: string
    detected: DetectToolRequestBlockResult
    toolRequestCompleted: boolean
  }
  getText: () => string
  isToolRequestCompleted: () => boolean
}

// KISS: use detectToolRequestBlock on the accumulated buffer.
// This keeps stream/non-stream semantics identical and lets callers stop reading once completed.
export function createToolRequestStreamTruncator(initialText?: unknown): ToolRequestStreamTruncator {
  let out = typeof initialText === 'string' ? initialText : String(initialText ?? '')
  let completed = false

  const appendDelta: ToolRequestStreamTruncator['appendDelta'] = (delta) => {
    if (completed) {
      const detected = detectToolRequestBlock(out)
      return { text: out, detected, toolRequestCompleted: true }
    }

    const add = typeof delta === 'string' ? delta : String(delta ?? '')
    if (!add) {
      const detected = detectToolRequestBlock(out)
      return { text: out, detected, toolRequestCompleted: false }
    }

    const nextOut = out + add
    const detected = detectToolRequestBlock(nextOut)
    if (detected.status === 'complete') {
      out = detected.keptText
      completed = true
      return { text: out, detected, toolRequestCompleted: true }
    }

    out = nextOut
    return { text: out, detected, toolRequestCompleted: false }
  }

  return {
    appendDelta,
    getText: () => out,
    isToolRequestCompleted: () => completed,
  }
}

