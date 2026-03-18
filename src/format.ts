import {
  ToolResponseEnd,
  ToolResponseStart,
  ValueEnd,
  ValueStart,
  type ToolResult,
} from "./types.js";

export function formatToolResponse(results: ToolResult[]): string {
  const lines: string[] = [];
  lines.push(ToolResponseStart);

  for (let i = 0; i < results.length; i++) {
    const index = i + 1;
    const result = results[i];

    lines.push(`  <<[RESULT-${index}]>>`);
    lines.push(`    tool_name:${ValueStart}${result.tool_name}${ValueEnd}`);
    lines.push(`    status:${ValueStart}${result.status}${ValueEnd}`);

    if (result.status === "success") {
      lines.push(`    output:${ValueStart}${result.output ?? ""}${ValueEnd}`);
    } else {
      lines.push(`    error:${ValueStart}${result.error ?? ""}${ValueEnd}`);
    }
    lines.push(`  <<[/RESULT-${index}]>>`);
  }

  lines.push(ToolResponseEnd);
  return lines.join("\n");
}

