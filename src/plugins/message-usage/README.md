# message-usage

在每条 assistant 消息底部显示 token 用量和耗时信息。

## Slot

- `message:footer` — 渲染输入/输出 token 使用量、首 token 延迟（Latency）、总耗时（Total）

## 机制

从消息的 `usage` 字段读取 `inputTokens`、`outputTokens`、`latencyMs`、`totalMs`，仅在 assistant 消息有 usage 数据时渲染。

- `latencyMs` — 请求发出到第一个 token 返回的时间
- `totalMs` — 请求发出到响应完成的总时间
