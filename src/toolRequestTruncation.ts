import {
  detectToolRequestBlock,
  TOOL_REQUEST_CLOSE_MARKER,
  TOOL_REQUEST_OPEN_MARKER,
  type DetectToolRequestBlockResult,
} from './detectToolRequestBlock.js'

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

function normText(input: unknown) {
  return typeof input === 'string' ? input : String(input ?? '')
}

function buildDetectedNone(text: string): DetectToolRequestBlockResult {
  return {
    status: 'none',
    hasToolRequestOpen: false,
    shouldTruncate: false,
    blockStart: -1,
    blockEnd: -1,
    truncateAt: -1,
    prefixText: text,
    blockText: '',
    keptText: text,
    trailingText: '',
  }
}

function buildDetectedIncomplete(text: string, blockStart: number): DetectToolRequestBlockResult {
  return {
    status: 'incomplete',
    hasToolRequestOpen: true,
    shouldTruncate: false,
    blockStart,
    blockEnd: -1,
    truncateAt: -1,
    prefixText: text.slice(0, blockStart),
    blockText: text.slice(blockStart),
    keptText: text,
    trailingText: '',
  }
}

function buildDetectedComplete(text: string, blockStart: number, blockEnd: number): DetectToolRequestBlockResult {
  return {
    status: 'complete',
    hasToolRequestOpen: true,
    shouldTruncate: true,
    blockStart,
    blockEnd,
    truncateAt: blockEnd,
    prefixText: text.slice(0, blockStart),
    blockText: text.slice(blockStart, blockEnd),
    keptText: text.slice(0, blockEnd),
    trailingText: text.slice(blockEnd),
  }
}

// KISS: preserve detectToolRequestBlock semantics, but avoid O(n^2) full rescans during streaming.
export function createToolRequestStreamTruncator(initialText?: unknown): ToolRequestStreamTruncator {
  let out = normText(initialText)
  let completed = false

  // Keep the same rule as detectToolRequestBlock: first open marker wins.
  let blockStart = out.indexOf(TOOL_REQUEST_OPEN_MARKER)

  // We only ever need to search close marker forward from the first possible position.
  let closeSearchFrom = blockStart >= 0 ? blockStart + TOOL_REQUEST_OPEN_MARKER.length : 0
  let completedBlockEnd = -1

  const appendDelta: ToolRequestStreamTruncator['appendDelta'] = (delta) => {
    if (completed) {
      const detected =
        blockStart >= 0 && completedBlockEnd >= 0
          ? buildDetectedComplete(out, blockStart, completedBlockEnd)
          : detectToolRequestBlock(out)
      return { text: out, detected, toolRequestCompleted: true }
    }

    const add = normText(delta)
    if (!add) {
      if (blockStart < 0) return { text: out, detected: buildDetectedNone(out), toolRequestCompleted: false }
      return { text: out, detected: buildDetectedIncomplete(out, blockStart), toolRequestCompleted: false }
    }

    const nextOut = out + add

    if (blockStart < 0) {
      // Only scan the overlap window near the append boundary, so we can catch markers split across chunks.
      const scanFrom = Math.max(0, out.length - (TOOL_REQUEST_OPEN_MARKER.length - 1))
      const openIdx = nextOut.indexOf(TOOL_REQUEST_OPEN_MARKER, scanFrom)
      if (openIdx >= 0) {
        blockStart = openIdx
        closeSearchFrom = blockStart + TOOL_REQUEST_OPEN_MARKER.length
      }
    }

    if (blockStart >= 0) {
      const overlap = TOOL_REQUEST_CLOSE_MARKER.length - 1
      const scanFrom = Math.max(blockStart + TOOL_REQUEST_OPEN_MARKER.length, closeSearchFrom - overlap, 0)
      const closeIdx = nextOut.indexOf(TOOL_REQUEST_CLOSE_MARKER, scanFrom)
      if (closeIdx >= 0) {
        const blockEnd = closeIdx + TOOL_REQUEST_CLOSE_MARKER.length
        const detected = buildDetectedComplete(nextOut, blockStart, blockEnd)
        out = detected.keptText
        completed = true
        completedBlockEnd = blockEnd
        return { text: out, detected, toolRequestCompleted: true }
      }
      closeSearchFrom = nextOut.length
    }

    out = nextOut
    if (blockStart < 0) return { text: out, detected: buildDetectedNone(out), toolRequestCompleted: false }
    return { text: out, detected: buildDetectedIncomplete(out, blockStart), toolRequestCompleted: false }
  }

  return {
    appendDelta,
    getText: () => out,
    isToolRequestCompleted: () => completed,
  }
}
