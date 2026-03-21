export const TOOL_REQUEST_OPEN_MARKER = '<<<[TOOL_REQUEST]>>>'
export const TOOL_REQUEST_CLOSE_MARKER = '<<<[END_TOOL_REQUEST]>>>'

export type ToolRequestBlockStatus = 'none' | 'incomplete' | 'complete'

export type DetectToolRequestBlockResult =
  | {
      status: 'none'
      hasToolRequestOpen: false
      shouldTruncate: false
      blockStart: -1
      blockEnd: -1
      truncateAt: -1
      prefixText: string
      blockText: ''
      keptText: string
      trailingText: ''
    }
  | {
      status: 'incomplete'
      hasToolRequestOpen: true
      shouldTruncate: false
      blockStart: number
      blockEnd: -1
      truncateAt: -1
      prefixText: string
      blockText: string
      keptText: string
      trailingText: ''
    }
  | {
      status: 'complete'
      hasToolRequestOpen: true
      shouldTruncate: true
      blockStart: number
      blockEnd: number
      truncateAt: number
      prefixText: string
      blockText: string
      keptText: string
      trailingText: string
    }

export function detectToolRequestBlock(input: unknown): DetectToolRequestBlockResult {
  const text = typeof input === 'string' ? input : String(input ?? '')
  const blockStart = text.indexOf(TOOL_REQUEST_OPEN_MARKER)

  if (blockStart < 0) {
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

  const prefixText = text.slice(0, blockStart)
  const closeMarkerIndex = text.indexOf(
    TOOL_REQUEST_CLOSE_MARKER,
    blockStart + TOOL_REQUEST_OPEN_MARKER.length,
  )

  if (closeMarkerIndex < 0) {
    return {
      status: 'incomplete',
      hasToolRequestOpen: true,
      shouldTruncate: false,
      blockStart,
      blockEnd: -1,
      truncateAt: -1,
      prefixText,
      blockText: text.slice(blockStart),
      keptText: text,
      trailingText: '',
    }
  }

  const blockEnd = closeMarkerIndex + TOOL_REQUEST_CLOSE_MARKER.length
  return {
    status: 'complete',
    hasToolRequestOpen: true,
    shouldTruncate: true,
    blockStart,
    blockEnd,
    truncateAt: blockEnd,
    prefixText,
    blockText: text.slice(blockStart, blockEnd),
    keptText: text.slice(0, blockEnd),
    trailingText: text.slice(blockEnd),
  }
}

