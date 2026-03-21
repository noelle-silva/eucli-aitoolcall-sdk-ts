export const TOOL_RESPONSE_OPEN_MARKER = '<<<[TOOL_RESPONSE]>>>'
export const TOOL_RESPONSE_CLOSE_MARKER = '<<<[END_TOOL_RESPONSE]>>>'

export type ToolResponseResult = {
  tool_name: string
  status: 'success' | 'failed' | 'timeout' | string
  output?: string
  error?: string
  duration_ms?: number
}

function safeText(v: unknown) {
  return typeof v === 'string' ? v : String(v ?? '')
}

export function formatToolResponseBlock(results: ToolResponseResult[]): string {
  const items = Array.isArray(results) ? results : []

  const lines: string[] = []
  lines.push(TOOL_RESPONSE_OPEN_MARKER)

  for (let i = 0; i < items.length; i++) {
    const index = i + 1
    const r = items[i] || ({} as any)
    const toolName = safeText((r as any).tool_name).trim()
    const status = safeText((r as any).status).trim() || 'failed'
    const output = safeText((r as any).output)
    const error = safeText((r as any).error)
    const duration = (r as any).duration_ms
    const duration_ms =
      typeof duration === 'number' && Number.isFinite(duration) && duration >= 0
        ? Math.round(duration)
        : undefined

    lines.push(`  <<[RESULT-${index}]>>`)
    lines.push(`    tool_name:「start」${toolName}「end」`)
    lines.push(`    status:「start」${status}「end」`)
    if (typeof duration_ms === 'number') lines.push(`    duration_ms:「start」${String(duration_ms)}「end」`)
    if (status === 'success') {
      lines.push(`    output:「start」${output}「end」`)
    } else {
      lines.push(`    error:「start」${error || output}「end」`)
    }
    lines.push(`  <<[/RESULT-${index}]>>`)
  }

  lines.push(TOOL_RESPONSE_CLOSE_MARKER)
  return lines.join('\n')
}

