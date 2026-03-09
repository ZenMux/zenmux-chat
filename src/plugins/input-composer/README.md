# input-composer

完整的消息输入区域，包含文本输入框、附件预览和发送/停止控制。

## Slot

- `input:composer` — 渲染整个输入区域组件

## 功能

- **文本输入**：多行 textarea，Enter 发送，Shift+Enter 换行
- **附件预览**：显示待发送的 pending attachments，支持图片缩略图和文件图标，可单独移除
- **发送按钮**：有内容时激活，点击发送消息并清空输入
- **停止按钮**：streaming 状态下替换发送按钮，点击中止当前请求
- **扩展 actions**：底部通过 `<SlotRenderer slot="input:actions" />` 支持其他插件注入按钮（如文件上传）
