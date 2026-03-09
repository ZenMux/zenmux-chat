# message-files

显示模型生成的图片文件。

## Slot

- `message:files` — 在每条消息内容下方渲染生成的图片

## 机制

从 orchestrator state 按 `messageId` 查找消息的 `generatedFiles` 字段，将 base64 数据渲染为 `<img>` 标签。图片加载完成后通过 `ScrollService` 触发滚动到底部，确保图片高度变化不会导致滚动位置错误。

## 依赖

- `ScrollService`（用于图片加载后自动滚动）
