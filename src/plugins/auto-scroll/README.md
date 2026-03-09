# auto-scroll

流式输出时自动将消息区域滚动到底部。

## Slot

无（纯逻辑插件）

## 机制

通过请求生命周期钩子 `onStreamChunk` 监听流式输出事件，每次收到新 chunk 时从内核 `ScrollService` 获取消息容器 DOM，并将 `scrollTop` 设为 `scrollHeight`。

## 依赖

- `ScrollService`（由 ChatPanel 注册到 `kernel.services`）
