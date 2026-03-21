import type { ToolRequestCall } from './parseToolRequestCalls.js'

export type ToolCallServerConfig = {
  baseUrl: string
  token?: string
}

export type ToolCallServerExecuteCall = {
  tool_name: string
  parameters: Record<string, string>
  agent?: string
  schedule?: string
  note?: string
}

export type ToolCallServerExecuteRequestBody = {
  session_id?: string
  provider_name?: string
  timeout_ms: number
  calls: ToolCallServerExecuteCall[]
}

export type ToolCallServerExecuteResult = {
  tool_name: string
  status: 'success' | 'failed' | 'timeout' | string
  output?: string
  error?: string
  duration_ms?: number
}

export type ToolCallServerExecuteResponseBody = {
  results: ToolCallServerExecuteResult[]
}

export type ToolCallServerHttpRequest = (req: {
  method: string
  url: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}) => Promise<{ status?: number; body?: unknown } | unknown>

function trimSlash(s: string) {
  return s.replace(/\/+$/, '')
}

function toTextBody(body: unknown) {
  if (typeof body === 'string') return body
  if (body == null) return ''
  try {
    return JSON.stringify(body)
  } catch (_) {
    return String(body)
  }
}

export function mapParsedCallsToServerCalls(calls: ToolRequestCall[]): ToolCallServerExecuteCall[] {
  return calls.map((c) => ({
    tool_name: String(c.tool_name || ''),
    parameters: c.parameters || {},
    agent: c.agent,
    schedule: c.schedule,
    note: c.note,
  }))
}

export async function executeToolCallsOnServer(args: {
  request: ToolCallServerHttpRequest
  server: ToolCallServerConfig
  body: ToolCallServerExecuteRequestBody
}): Promise<{ ok: true; status: number; json: ToolCallServerExecuteResponseBody | null; rawText: string }> {
  const baseUrl = trimSlash(String(args.server?.baseUrl || '').trim())
  if (!baseUrl) throw new Error('工具服务器 baseUrl 为空')

  const url = `${baseUrl}/internal/tool-call/execute`
  const token = String(args.server?.token || '').trim()

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const reqBody = JSON.stringify(args.body || {})
  const resp = await args.request({ method: 'POST', url, headers, body: reqBody, timeoutMs: 120000 })

  const status = Number((resp as any)?.status || 0)
  const rawText = toTextBody((resp as any)?.body)

  if (!isFinite(status) || status < 200 || status >= 300) {
    let msg = rawText
    try {
      const j = JSON.parse(rawText || '{}')
      msg = String((j as any)?.error || (j as any)?.message || msg || `HTTP ${status}`)
    } catch (_) {}
    throw new Error(`工具服务器请求失败：HTTP ${status || '0'} ${msg || ''}`.trim())
  }

  let json: ToolCallServerExecuteResponseBody | null = null
  try {
    json = rawText ? (JSON.parse(rawText) as any) : null
  } catch (_) {
    json = null
  }

  return { ok: true, status, json, rawText }
}

