# streaming-indicator

流式响应进行中的状态提示。

## Slot

- `message:streaming` — 当窗口处于 `streaming` 状态时显示 "AI is responding..."

## 机制

从 orchestrator state 读取窗口 `status`，仅在 `status === 'streaming'` 时渲染提示文本。
