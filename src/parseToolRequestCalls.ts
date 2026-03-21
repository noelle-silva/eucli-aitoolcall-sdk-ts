import { detectToolRequestBlock } from './detectToolRequestBlock.js'

export type ToolRequestCall = {
  /**
   * 1-based ordinal in appearance order.
   * Protocol may also include CALL-N markers, but we keep order-by-appearance as source of truth.
   */
  index: number
  tool_name: string
  parameters: Record<string, string>
  agent?: string
  schedule?: string
  note?: string
  /**
   * For debugging and UI rendering (optional).
   */
  _meta?: { callTag: string; rawBlock: string; rawFields: Record<string, string> }
}

export type ParseToolRequestCallsResult =
  | { ok: true; calls: ToolRequestCall[]; warnings: string[] }
  | { ok: false; calls: ToolRequestCall[]; warnings: string[]; error: string }

const RESERVED_KEYS = new Set(['tool_name', 'agent', 'schedule', 'note'])

function normText(input: unknown) {
  return typeof input === 'string' ? input : String(input ?? '')
}

function parseCallBlocks(toolRequestBlockText: string) {
  const text = normText(toolRequestBlockText)
  const calls: Array<{ tag: string; content: string; raw: string }> = []

  let i = 0
  while (true) {
    const openIdx = text.indexOf('<<[CALL', i)
    if (openIdx < 0) break

    const tagEnd = text.indexOf(']>>', openIdx)
    if (tagEnd < 0) break

    const tag = text.slice(openIdx + '<<['.length, tagEnd).trim() // CALL or CALL-1...
    const closeMarker = `<<[/${tag}]>>`
    const closeIdx = text.indexOf(closeMarker, tagEnd + 3)
    if (closeIdx < 0) break

    const contentStart = tagEnd + 3
    const content = text.slice(contentStart, closeIdx)
    const raw = text.slice(openIdx, closeIdx + closeMarker.length)
    calls.push({ tag, content, raw })

    i = closeIdx + closeMarker.length
  }

  return calls
}

function parseFields(callContent: string) {
  const rawFields: Record<string, string> = {}
  const warnings: string[] = []

  const re = /([A-Za-z0-9_]+)\s*:\s*「start」([\s\S]*?)「end」/g
  let m: RegExpExecArray | null
  while ((m = re.exec(callContent))) {
    const key = String(m[1] || '').trim()
    const val = String(m[2] ?? '').trim()
    if (!key) continue
    if (Object.prototype.hasOwnProperty.call(rawFields, key)) {
      warnings.push(`字段重复：${key}`)
    }
    rawFields[key] = val
  }

  return { rawFields, warnings }
}

export function parseToolRequestCalls(
  input: unknown,
  opts?: { includeMeta?: boolean },
): ParseToolRequestCallsResult {
  const text = normText(input)
  const detected = detectToolRequestBlock(text)
  if (detected.status !== 'complete') {
    return { ok: false, calls: [], warnings: [], error: '未检测到完整 TOOL_REQUEST 块' }
  }

  const callBlocks = parseCallBlocks(detected.blockText)
  if (!callBlocks.length) {
    return { ok: false, calls: [], warnings: [], error: 'TOOL_REQUEST 内未找到 CALL 块' }
  }

  const calls: ToolRequestCall[] = []
  const warnings: string[] = []
  let hadError = false
  let firstError = ''

  for (let idx = 0; idx < callBlocks.length; idx++) {
    const b = callBlocks[idx]
    const parsed = parseFields(b.content)
    warnings.push(...parsed.warnings.map((w) => `CALL-${idx + 1}: ${w}`))

    const tool_name = String(parsed.rawFields.tool_name || '').trim()
    if (!tool_name) {
      hadError = true
      if (!firstError) firstError = `CALL-${idx + 1} 缺少 tool_name`
    }

    const parameters: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed.rawFields)) {
      if (RESERVED_KEYS.has(k)) continue
      parameters[k] = v
    }

    const call: ToolRequestCall = {
      index: idx + 1,
      tool_name,
      parameters,
      agent: parsed.rawFields.agent || undefined,
      schedule: parsed.rawFields.schedule || undefined,
      note: parsed.rawFields.note || undefined,
    }

    if (opts?.includeMeta) {
      call._meta = { callTag: b.tag, rawBlock: b.raw, rawFields: parsed.rawFields }
    }

    calls.push(call)
  }

  if (hadError) return { ok: false, calls, warnings, error: firstError || '解析失败' }
  return { ok: true, calls, warnings }
}

