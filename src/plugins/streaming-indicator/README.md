# streaming-indicator

流式响应进行中的三阶段状态指示器：发送中 → 思考中 → 输出中。

## Slot

- `message:streaming` — 在正在流式输出的 assistant 消息下方显示阶段进度条

## 机制

从 orchestrator state 读取窗口 `status` 和 `streamingMessageId`，仅在 `status === 'streaming'` 时渲染。

### 渲染位置

- **Per-message 渲染**：在 assistant 消息列表内，仅对 `streamingMessageId` 匹配的消息渲染（支持重试中间消息时指示器跟随）
- **Footer 兜底**：当 `streamingMessageId` 尚未设置时（如 `sendMessage` 初始阶段，assistant 消息未创建），在列表底部显示

### 阶段推导

根据目标消息状态判断当前阶段：
- `sending` — assistant 消息尚未创建或无内容
- `thinking` — 有 `reasoning` 但无 `content`
- `outputting` — 有 `content`
