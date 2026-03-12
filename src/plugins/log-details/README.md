# log-details

从模型 API 响应头中提取 `x-zenmux-requestid`，在 assistant 消息底部渲染日志详情链接。

## Slot

- `message:footer`（order: 10）— 渲染 "Log Detail" 链接，指向 `https://zenmux.ai/platform/logs/detail/{requestId}`；streaming 过程中隐藏

## 请求钩子

- `onResponseHeaders` — 提取响应头 `x-zenmux-requestid`，写入 `headersCtx.extras.zenmuxRequestId`

## 机制

1. 内核通过 `FetchInterceptor` 在 HTTP 响应到达时（流开始前）立即触发 `onResponseHeaders` 钩子
2. 插件从响应头提取 `x-zenmux-requestid`，写入 `extras`
3. Pipeline 通过 `onEarlyExtras` 回调将 extras 立即写入 `message.extras`
4. `LogDetailFooter` 组件读取 `message.extras.zenmuxRequestId` 渲染链接

## 注意事项

- 需要后端配置 `Access-Control-Expose-Headers: x-zenmux-requestid`，否则浏览器 CORS 策略会阻止前端读取自定义响应头
