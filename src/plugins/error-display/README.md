# error-display

请求失败时的错误面板展示。

## Slot

- `message:error` — 当窗口处于 `error` 状态时渲染完整错误信息

## 展示内容

- 错误标题 + HTTP 状态码
- 错误类型标签（`errorType`）
- 错误消息详情
- Request ID（如有）
- 可展开的 response body 原始内容
- 错误发生时间
