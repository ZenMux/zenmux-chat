# message-actions

在每条 assistant 消息底部提供操作按钮：复制、重试、删除。

## Slot

- `message:footer`（order: -1，位于 usage 左侧）— 渲染复制 / 重试 / 删除按钮

## 机制

- **复制**：将消息 `content` 写入剪贴板
- **重试**：调用 `orchestrator.retryMessage(windowId, messageId)`，原地更新该 assistant 消息，不影响后续消息；使用当前选中的模型
- **删除**：移除该 assistant 消息及其配对的 user 消息

### Streaming 行为

- 正在流式输出的消息（`streamingMessageId` 匹配）：隐藏按钮
- 其它 assistant 消息：禁用按钮（灰色不可点击）
- 非 streaming 状态：正常可用
