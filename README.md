# eucli-aitoolcall-sdk (TypeScript)

用于解析/检测 AI 输出中的 `TOOL_REQUEST` 文本块、调用 `ai-tool-call-server` 执行工具，并生成 `TOOL_RESPONSE` 文本块回注。

## 安装

本包发布在 GitHub Packages（npm registry）。

1) 在你的客户端项目根目录创建 `.npmrc`（不要提交到 git）：

```
@noelle-silva:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=PASTE_YOUR_PAT_HERE
```

2) 安装：

```
npm i @noelle-silva/eucli-aitoolcall-sdk
```

## 使用

### 1) 非流式：一次性检测（只检测完整外层块，便于你自行决定是否截断）

```ts
import { detectToolRequestBlock } from "@noelle-silva/eucli-aitoolcall-sdk";

const r = detectToolRequestBlock(aiOutputText);
if (r.status === "complete") {
  // r.prefixText: 工具块之前的普通文本（可展示）
  // r.blockText: 完整 TOOL_REQUEST 块
  // r.keptText: prefix + block（用于截断）
}
```

### 2) 流式：增量检测

```ts
import { createToolRequestStreamTruncator } from "@noelle-silva/eucli-aitoolcall-sdk";

const t = createToolRequestStreamTruncator("");
const r = t.appendDelta(chunk);
// r.text: 当前累计文本（当命中完整 TOOL_REQUEST 外层块后，会自动截断在块闭合处）
// r.toolRequestCompleted: 是否已完成并截断
```

### 3) 执行工具 + 生成回注块

```ts
import {
  executeToolCallsOnServer,
  mapParsedCallsToServerCalls,
  parseToolRequestCalls,
  formatToolResponseBlock,
} from "@noelle-silva/eucli-aitoolcall-sdk";

const parsed = parseToolRequestCalls(aiOutputText);
if (!parsed.ok) throw new Error(parsed.error);

const resp = await executeToolCallsOnServer({
  request: async ({ method, url, headers, body }) => {
    const r = await fetch(url, { method, headers, body });
    return { status: r.status, body: await r.text() };
  },
  server: { baseUrl: "http://localhost:9083", token: process.env.TOOL_CALL_SERVER_TOKEN },
  body: { timeout_ms: 30_000, calls: mapParsedCallsToServerCalls(parsed.calls) },
});

const results = resp.json?.results ?? [];
const toolResponseBlock = formatToolResponseBlock(results);
// 把 toolResponseBlock 追加进对话上下文后，再发起下一轮模型调用
```

## 约定

- 模型通过系统提示词被要求严格输出本体系的文本块协议（`TOOL_REQUEST / TOOL_RESPONSE`）。
- `CALL-1..N` 与 `RESULT-1..N` 采用顺序关联，结果顺序必须与请求顺序一致。
- `found` 只表示命中完整 `TOOL_REQUEST` 外层块，不表示块内解析一定成功。
