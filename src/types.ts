export const ToolRequestStart = "<<<[TOOL_REQUEST]>>>";
export const ToolRequestEnd = "<<<[END_TOOL_REQUEST]>>>";
export const ToolResponseStart = "<<<[TOOL_RESPONSE]>>>";
export const ToolResponseEnd = "<<<[END_TOOL_RESPONSE]>>>";

export const ValueStart = "「start」";
export const ValueEnd = "「end」";

export type ToolCall = {
  tool_name: string;
  parameters: Record<string, string>;
  agent?: string;
  schedule?: string;
  note?: string;
};

export type ToolResult = {
  tool_name: string;
  status: string;
  output?: string;
  error?: string;
  duration_ms?: number;
};

export type DetectResult = {
  found: boolean;
  content: string;
  raw_block?: string;
  calls?: ToolCall[];
  parse_error?: string;
};

export type ExecuteOptions = {
  session_id?: string;
  provider_name?: string;
  timeout_ms?: number;
};

export type ServerConfig = {
  base_url: string;
  token?: string;
  fetch?: typeof fetch;
};

