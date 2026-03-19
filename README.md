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

### 1) 非流式：一次性检测

```ts
import { detectInText } from "@noelle-silva/eucli-aitoolcall-sdk";

const r = detectInText(aiOutputText);
if (r.found) {
  // r.content: 工具块之前的普通文本（可展示）
  // r.raw_block: 完整 TOOL_REQUEST 块（可展示）
  // r.calls: 解析成功时可直接执行
  // r.parse_error: 解析失败原因；但 found 依然表示“完整外层块已命中”
}
```

### 2) 流式：增量检测

```ts
import { Detector } from "@noelle-silva/eucli-aitoolcall-sdk";

const d = new Detector();
const { flush, result } = d.feedChunk(chunk);
// flush: 当前可以安全输出给用户的文本片段
// result: 一旦检测到完整 TOOL_REQUEST 外层块，就会返回
//         之后应立即截断后续模型输出；是否能 parse 出 calls 是下一阶段问题
```

### 3) 执行工具 + 生成回注块

```ts
import { executeCalls, formatToolResponse } from "@noelle-silva/eucli-aitoolcall-sdk";

const results = await executeCalls(
  { base_url: "http://localhost:9083", token: process.env.TOOL_CALL_SERVER_TOKEN },
  calls,
  { session_id: "optional", provider_name: "optional", timeout_ms: 30_000 },
);

const toolResponseBlock = formatToolResponse(results);
// 把 toolResponseBlock 追加进对话上下文后，再发起下一轮模型调用
```

## 约定

- 模型通过系统提示词被要求严格输出本体系的文本块协议（`TOOL_REQUEST / TOOL_RESPONSE`）。
- `CALL-1..N` 与 `RESULT-1..N` 采用顺序关联，结果顺序必须与请求顺序一致。
- `found` 只表示命中完整 `TOOL_REQUEST` 外层块，不表示块内解析一定成功。
