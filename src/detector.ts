import { ToolRequestEnd, ToolRequestStart, type DetectResult } from "./types.js";
import { parseToolRequest } from "./parser.js";

type State = "normal" | "in_block";

export class Detector {
  private buffer = "";
  private state: State = "normal";
  private blockStart = 0;

  feedChunk(chunk: string): { flush: string; result?: DetectResult } {
    this.buffer += chunk;

    if (this.state === "normal") return this.handleNormal(this.buffer);
    return this.handleInBlock(this.buffer);
  }

  flush(): string {
    const content = this.buffer;
    this.reset();
    return content;
  }

  reset(): void {
    this.buffer = "";
    this.state = "normal";
    this.blockStart = 0;
  }

  private handleNormal(text: string): { flush: string; result?: DetectResult } {
    const startIdx = text.indexOf(ToolRequestStart);
    if (startIdx !== -1) {
      const prefix = text.slice(0, startIdx);

      this.buffer = text.slice(startIdx);
      this.state = "in_block";
      this.blockStart = 0;

      const { result } = this.handleInBlock(this.buffer);
      return { flush: prefix, result };
    }

    const safeFlush = getSafeFlush(text, ToolRequestStart);
    if (safeFlush.length > 0) this.buffer = text.slice(safeFlush.length);
    return { flush: safeFlush };
  }

  private handleInBlock(text: string): { flush: string; result?: DetectResult } {
    const endIdx = text.indexOf(ToolRequestEnd);
    if (endIdx === -1) {
      if (this.blockStart > 0) return { flush: text.slice(0, this.blockStart) };
      return { flush: "" };
    }

    const blockEnd = endIdx + ToolRequestEnd.length;
    const rawBlock = text.slice(this.blockStart, blockEnd);

    let calls;
    try {
      calls = parseToolRequest(rawBlock);
    } catch {
      this.reset();
      return { flush: text };
    }

    const result: DetectResult = {
      found: true,
      content: text.slice(0, this.blockStart),
      raw_block: rawBlock,
      calls,
    };

    this.reset();
    return { flush: "", result };
  }
}

export function detectInText(text: string): DetectResult {
  const startIdx = text.indexOf(ToolRequestStart);
  if (startIdx === -1) return { found: false, content: text };

  const endIdx = text.indexOf(ToolRequestEnd);
  if (endIdx === -1) return { found: false, content: text };

  const rawBlock = text.slice(startIdx, endIdx + ToolRequestEnd.length);
  try {
    const calls = parseToolRequest(rawBlock);
    return { found: true, content: text.slice(0, startIdx), raw_block: rawBlock, calls };
  } catch {
    return { found: false, content: text };
  }
}

function getSafeFlush(text: string, marker: string): string {
  for (let i = 1; i < marker.length && i <= text.length; i++) {
    const suffix = text.slice(text.length - i);
    const prefix = marker.slice(0, i);
    if (suffix === prefix) return text.slice(0, text.length - i);
  }
  return text;
}

