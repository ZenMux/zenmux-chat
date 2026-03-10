# message-usage

在每条 assistant 消息底部显示 token 用量信息。

## Slot

- `message:footer` — 渲染输入/输出 token 使用量

## 机制

从消息的 `usage` 字段读取 `inputTokens` 和 `outputTokens`，仅在 assistant 消息有 usage 数据时渲染。
