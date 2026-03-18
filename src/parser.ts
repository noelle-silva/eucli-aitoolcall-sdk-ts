import {
  ToolRequestEnd,
  ToolRequestStart,
  ValueEnd,
  ValueStart,
  type ToolCall,
} from "./types.js";

export function extractToolRequestBlock(text: string): {
  found: boolean;
  start_idx: number;
  block?: string;
} {
  const startIdx = text.indexOf(ToolRequestStart);
  if (startIdx === -1) return { found: false, start_idx: -1 };

  const endIdx = text.indexOf(ToolRequestEnd);
  if (endIdx === -1) return { found: false, start_idx: startIdx };

  const block = text.slice(startIdx, endIdx + ToolRequestEnd.length);
  return { found: true, start_idx: startIdx, block };
}

export function parseToolRequest(block: string): ToolCall[] {
  const startIdx = block.indexOf(ToolRequestStart);
  if (startIdx === -1) throw new Error("missing TOOL_REQUEST start");

  const endIdx = block.indexOf(ToolRequestEnd);
  if (endIdx === -1) throw new Error("missing TOOL_REQUEST end");

  const content = block.slice(startIdx + ToolRequestStart.length, endIdx);
  const calls: ToolCall[] = [];

  let rest = content;
  let nextImplicitIndex = 1;

  while (true) {
    const openIdx = rest.indexOf("<<[CALL");
    if (openIdx === -1) break;
    rest = rest.slice(openIdx);

    const openTag = parseOpenCallTag(rest);
    const callIndex = openTag.index ?? nextImplicitIndex++;
    const afterOpen = rest.slice(openTag.raw.length);

    const closeTag = openTag.index ? `<<[/CALL-${callIndex}]>>` : "<<[/CALL]>>";
    const closeIdx = afterOpen.indexOf(closeTag);
    if (closeIdx === -1) throw new Error(`missing closing tag ${closeTag}`);

    const callContent = afterOpen.slice(0, closeIdx);
    calls.push(parseCallContent(callContent));

    rest = afterOpen.slice(closeIdx + closeTag.length);
  }

  if (calls.length === 0) throw new Error("no CALL blocks found");
  return calls;
}

function parseOpenCallTag(text: string): { raw: string; index?: number } {
  const endIdx = text.indexOf("]>>");
  if (endIdx === -1) throw new Error("invalid CALL open tag: missing ]>>");

  const raw = text.slice(0, endIdx + 3);
  if (!raw.startsWith("<<[CALL")) throw new Error(`invalid CALL open tag: ${raw}`);

  const inner = raw.slice("<<[CALL".length, raw.length - "]>>".length).trim();
  if (inner === "") return { raw };

  if (!inner.startsWith("-")) throw new Error(`invalid CALL open tag: ${raw}`);
  const num = Number.parseInt(inner.slice(1), 10);
  if (!Number.isFinite(num) || num <= 0) throw new Error(`invalid CALL index in tag: ${raw}`);
  return { raw, index: num };
}

function parseCallContent(content: string): ToolCall {
  const call: ToolCall = { tool_name: "", parameters: {} };

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const valuePart = line.slice(colonIdx + 1).trim();

    if (!valuePart.startsWith(ValueStart) || !valuePart.endsWith(ValueEnd)) continue;
    const value = valuePart.slice(ValueStart.length, valuePart.length - ValueEnd.length).trim();

    if (value.includes(ValueStart) || value.includes(ValueEnd)) {
      throw new Error("value contains reserved delimiter");
    }

    switch (key) {
      case "tool_name":
        call.tool_name = value;
        break;
      case "agent":
        call.agent = value;
        break;
      case "schedule":
        call.schedule = value;
        break;
      case "note":
        call.note = value;
        break;
      default:
        if (isReservedField(key)) {
          throw new Error(`tool parameter name conflicts with reserved field: ${key}`);
        }
        call.parameters[key] = value;
    }
  }

  if (!call.tool_name) throw new Error("tool_name is required");
  return call;
}

function isReservedField(name: string): boolean {
  return name === "tool_name" || name === "agent" || name === "schedule" || name === "note";
}

