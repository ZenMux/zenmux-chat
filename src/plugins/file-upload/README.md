# file-upload

文件/图片上传按钮，注入到输入区域的 actions 栏。

## Slot

- `input:actions` — 渲染 "+" 上传按钮，点击后打开文件选择器

## 机制

根据当前模型能力（通过 `ModelInfoService`）决定可上传的文件类型。选中文件后将其转为 base64 并作为 `pendingAttachment` 添加到当前聊天窗口。
