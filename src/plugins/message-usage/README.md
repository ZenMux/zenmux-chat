# message-usage

在每条消息底部显示 token 用量信息。

## Slot

- `message:footer` — 渲染 token 使用量（promptTokens / completionTokens / totalTokens）

## 机制

从 orchestrator state 中按 `messageId` 查找消息的 `usage` 字段，仅在 assistant 消息有 usage 数据时渲染。
