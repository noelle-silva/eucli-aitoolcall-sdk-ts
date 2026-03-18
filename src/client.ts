import type { ExecuteOptions, ServerConfig, ToolCall, ToolResult } from "./types.js";

export async function executeCalls(
  server: ServerConfig,
  calls: ToolCall[],
  options: ExecuteOptions = {},
): Promise<ToolResult[]> {
  const baseUrl = server.base_url.replace(/\/+$/, "");
  if (!baseUrl) throw new Error("server.base_url is required");

  const fetchImpl = server.fetch ?? fetch;
  const timeoutMs = options.timeout_ms && options.timeout_ms > 0 ? options.timeout_ms : 30_000;

  const body = JSON.stringify({
    session_id: options.session_id,
    provider_name: options.provider_name,
    timeout_ms: timeoutMs,
    calls,
  });

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (server.token) headers["Authorization"] = `Bearer ${server.token}`;

  const resp = await fetchImpl(`${baseUrl}/internal/tool-call/execute`, {
    method: "POST",
    headers,
    body,
  });

  if (!resp.ok) throw new Error(`execute failed: http ${resp.status}`);

  const decoded = (await resp.json()) as { results?: ToolResult[] };
  if (!decoded.results) return [];
  return decoded.results;
}

