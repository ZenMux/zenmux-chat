# request-config

用户可配置的请求参数：temperature、topP、maxTokens、systemPrompt。

## Slot

- `toolbar:right` — 参数配置按钮，展开后可开关和调整各参数

## State Slice

`requestConfig` — 每个参数为 `ParamEntry<T>` 结构（`{ enabled, value }`），只有用户主动启用的参数才会注入请求。

## 请求钩子

- `onBuildRequest` — 将已启用的参数写入 `reqCtx.params`
